import React, { useState } from "react";
import { Box, render, Text, useApp, useInput } from "ink";

export let typing = false;

const Screen = () => {
  const { exit } = useApp();

  const [str, setStr] = useState<string>("");

  useInput((input, key) => {
    if (key.ctrl && input == "c") {
      exit();
    }

    if (key.return) {
      typing = false;
      // When the user presses Enter, we can do something with the string
      console.log(`You typed: ${str}`);
      setStr(""); // Reset the string after processing
      return;
    }

    if (key.backspace || key.delete) {
      console.log("bs");
      setStr((prev) => prev.slice(0, -1));
      return;
    }

    if (input) {
      typing = true;
      setStr((prev) => prev + input);
    }
  });

  return (
    <>
      <Box borderStyle="round" width="100%" height="50%">
        <Text color="green">Type something:</Text>
        <Text>{str}</Text>
      </Box>
    </>
  );
};

export const run = () => render(<Screen />);
