package com.dream.basketball.utils;

import com.dream.basketball.storage.LocalUploadStore;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

import java.io.File;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.*;

/** P2-4 / P4-3: upload security (whitelist, safe filename, robust suffix, anti-traversal). */
class FileUtilsTest {

    private Path uploadDir;

    @BeforeEach
    void setUp() throws Exception {
        uploadDir = Files.createTempDirectory("fileutils-test");
        // emulate the @Value / @Autowired injected static fields
        FileUtils f = new FileUtils();
        f.setPicPath("/picImg/");
        f.setUploadStore(new LocalUploadStore(uploadDir.toString()));
    }

    // ---------- safeExtension robustness (P2-4: no more substring(-1) crash) ----------

    @Test
    void safeExtension_handlesEdgeCases() {
        assertEquals("png", FileUtils.safeExtension("photo.png"));
        assertEquals("png", FileUtils.safeExtension("photo.PNG"));        // lowercased
        assertEquals("jpg", FileUtils.safeExtension("a.b.jpg"));          // last dot
        assertEquals("gif", FileUtils.safeExtension("dir/sub/x.gif"));    // strips path
        assertEquals("gif", FileUtils.safeExtension("dir\\sub\\x.gif"));  // backslash path
        assertEquals("", FileUtils.safeExtension("noextension"));         // no dot -> "" (was crash)
        assertEquals("", FileUtils.safeExtension("trailingdot."));        // trailing dot
        assertEquals("", FileUtils.safeExtension(null));
    }

    // ---------- whitelist ----------

    @Test
    void upload_acceptsWhitelistedImage_andStoresUuidName() throws Exception {
        MockMultipartFile file = new MockMultipartFile("file", "myphoto.png", "image/png", new byte[]{1, 2, 3});
        String url = FileUtils.upload(file, uploadDir.toString(), "news1");

        // server-generated name decoupled from "myphoto"; original name not reused
        assertTrue(url.startsWith("/picImg/news1/"), url);
        assertTrue(url.endsWith(".png"), url);
        assertFalse(url.contains("myphoto"));
        // file actually written under the folder
        String storedName = url.substring(url.lastIndexOf('/') + 1);
        assertTrue(new File(uploadDir.toFile(), "news1/" + storedName).exists());
    }

    @Test
    void upload_rejectsDisallowedType() {
        MockMultipartFile html = new MockMultipartFile("file", "evil.html", "text/html",
                "<script>alert(1)</script>".getBytes());
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> FileUtils.upload(html, uploadDir.toString(), "news1"));
        assertTrue(ex.getMessage().contains("不支持的文件类型"));
    }

    @Test
    void upload_rejectsNoExtension() {
        MockMultipartFile noExt = new MockMultipartFile("file", "noext", "application/octet-stream", new byte[]{1});
        assertThrows(IllegalArgumentException.class,
                () -> FileUtils.upload(noExt, uploadDir.toString(), "news1"));
    }

    @Test
    void upload_rejectsEmptyFile() {
        MockMultipartFile empty = new MockMultipartFile("file", "x.png", "image/png", new byte[]{});
        assertThrows(IllegalArgumentException.class,
                () -> FileUtils.upload(empty, uploadDir.toString(), "news1"));
    }

    // ---------- path traversal ----------

    @Test
    void upload_sanitizesFolderKey_blockingTraversal() throws Exception {
        MockMultipartFile file = new MockMultipartFile("file", "x.jpg", "image/jpeg", new byte[]{9});
        String url = FileUtils.upload(file, uploadDir.toString(), "../../etc");

        // "../../etc" -> stripped to "etc"; no ".." escapes the upload root
        assertFalse(url.contains(".."));
        assertTrue(url.startsWith("/picImg/etc/"), url);
        // nothing was written outside the temp upload dir
        assertTrue(new File(uploadDir.toFile(), "etc").isDirectory());
    }

    // ---------- phase 1a: URL <-> storage key ----------

    @Test
    void keyOf_stripsPrefix() {
        assertEquals("topicfs-x/abc.pdf", FileUtils.keyOf("/picImg/topicfs-x/abc.pdf"));
        assertEquals("abc.png", FileUtils.keyOf("/picImg/abc.png"));
    }

    @Test
    void keyOf_rejectsAnythingNotOurs() {
        assertNull(FileUtils.keyOf(null));
        assertNull(FileUtils.keyOf("https://evil.example/x.png"));   // external
        assertNull(FileUtils.keyOf("javascript:alert(1)"));          // scheme injection
        assertNull(FileUtils.keyOf("/other/abc.png"));               // wrong prefix
        assertNull(FileUtils.keyOf("/picImg/"));                     // empty remainder
        assertNull(FileUtils.keyOf("/picImg//etc/passwd"));          // leading slash
        assertNull(FileUtils.keyOf("/picImg/../../etc/passwd"));     // traversal
        assertNull(FileUtils.keyOf("/picImg/a/../../b.png"));        // traversal mid-path
    }

    @Test
    void urlOf_isTheInverseOfKeyOf() {
        String url = "/picImg/topicfs-x/abc.pdf";
        assertEquals(url, FileUtils.urlOf(FileUtils.keyOf(url)));
        assertNull(FileUtils.urlOf(null));
    }

    // ---------- phase 1a: everything goes through the store ----------

    @Test
    void upload_storesViaUploadStore_andDedupesByContent() throws Exception {
        byte[] bytes = "same bytes".getBytes();
        String a = FileUtils.upload(new MockMultipartFile("file", "one.png", "image/png", bytes),
                uploadDir.toString(), "news1");
        String b = FileUtils.upload(new MockMultipartFile("file", "two.png", "image/png", bytes),
                uploadDir.toString(), "news1");

        // content-addressed naming: same bytes -> same key, and only one file on disk
        assertEquals(a, b);
        File dir = new File(uploadDir.toFile(), "news1");
        assertEquals(1, dir.listFiles().length);
    }

    @Test
    void deleteUploadFolder_refusesBlankKey() throws Exception {
        FileUtils.upload(new MockMultipartFile("file", "x.png", "image/png", new byte[]{7}),
                uploadDir.toString(), "news1");

        // a blank folder key would mean "wipe the whole upload root" — must be a no-op
        FileUtils.deleteUploadFolder(uploadDir.toString(), "");
        FileUtils.deleteUploadFolder(uploadDir.toString(), null);
        FileUtils.deleteUploadFolder(uploadDir.toString(), "///");   // sanitises to ""
        assertTrue(new File(uploadDir.toFile(), "news1").isDirectory());

        FileUtils.deleteUploadFolder(uploadDir.toString(), "news1");
        assertFalse(new File(uploadDir.toFile(), "news1").exists());
    }
}
