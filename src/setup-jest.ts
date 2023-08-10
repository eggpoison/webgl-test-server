import { SERVER } from "./server";
import Board from "./Board";

beforeAll(() => {
   Board.setup();
   SERVER.setup();
});