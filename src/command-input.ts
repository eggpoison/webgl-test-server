import readline from "node:readline";

const rl = readline.createInterface({
   input: process.stdin,
   output: process.stdout
});

const promptUser = (query: string) => new Promise(resolve => rl.question(query, resolve));

export async function startReadingInput(): Promise<void> {
   // Get input
   const userInput = await promptUser("Testing: ");
   console.log("received thing: " + userInput);

   // rl.on("line", input => {
   //    switch (input) {
   //       case "users": {
            
   //       }
   //    }
   // });
}