import readline from "node:readline";

export async function startReadingInput(): Promise<void> {
   const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
   });

   rl.on("line", input => {
      switch (input) {
         case "users": {
            
         }
      }
   });
}