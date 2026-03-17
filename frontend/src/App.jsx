import { useEffect, useState } from "react";

function App() {
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/hello")
      .then((res) => res.text())
      .then((data) => setMessage(data))
      .catch((error) => {
        console.error("request failed:", error);
        setMessage("request failed");
      });
  }, []);

  return (
    <div>
      <h1>React in Basketball1</h1>
      <p>{message}</p>
    </div>
  );
}

export default App;