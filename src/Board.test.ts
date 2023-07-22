import { Point, SETTINGS } from "webgl-test-shared";
import { SERVER } from "./server";
import Cow from "./entities/mobs/Cow";

test("Game objects can be created", () => {
   SERVER;
   
   const position = new Point(400, 400);
   const cow = new Cow(position);

   SERVER.board.forcePushGameObjectFromJoinBuffer(cow);
   
   // Check if the cow is in the board
   expect(SERVER.board.gameObjectIsInBoard(cow)).toBe(true);

   cow.remove();
   SERVER.board.forceRemoveGameObject(cow);
});

test("Game objects can be removed", () => {
   SERVER;
   
   const position = new Point(400, 400);
   const cow = new Cow(position);

   SERVER.board.forcePushGameObjectFromJoinBuffer(cow);

   cow.remove();
   SERVER.board.forceRemoveGameObject(cow);
   
   // Check if the cow is in the board
   expect(SERVER.board.gameObjectIsInBoard(cow)).toBe(false);
});

test("Game objects can be removed immediately after they are created", () => {
   SERVER;

   const position = new Point(400, 400);
   const cow = new Cow(position);

   cow.remove();
   
   // Check if the cow is in the board
   expect(SERVER.board.gameObjectIsInBoard(cow)).toBe(false);
});

test("Game objects are moved inside the world if they are outside the world border", () => {
   SERVER;
   
   const boardUnits = SETTINGS.BOARD_DIMENSIONS * SETTINGS.TILE_SIZE;
   
   const outsidePosition = new Point(boardUnits + 600, 0);

   const entity = new Cow(outsidePosition);
   expect(entity.position.x).toBeLessThan(boardUnits);

   entity.remove();
});