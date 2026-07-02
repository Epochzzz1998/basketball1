package com.dream.basketball.dto;

import com.dream.basketball.entity.UserInformation;
import lombok.Data;

@Data
public class UserInformationDto extends UserInformation {

    /** Title of the related news post, joined at read time (not persisted on the message). */
    private String newsTitle;

}
