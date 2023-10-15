import { Point, SETTINGS } from "webgl-test-shared";
import Cow from "./entities/mobs/Cow";
import Board from "./Board";

test("Game objects can be created", () => {
   const position = new Point(400, 400);
   const cow = new Cow(position);

   Board.pushJoinBuffer();
   
   // Check if the cow is in the board
   expect(Board.entityIsInBoard(cow)).toBe(true);

   cow.remove();
   Board.forceRemoveEntity(cow);
});

test("Game objects can be removed", () => {
   const position = new Point(400, 400);
   const cow = new Cow(position);

   Board.pushJoinBuffer();

   cow.remove();
   Board.forceRemoveEntity(cow);
   
   // Check if the cow is in the board
   expect(Board.entityIsInBoard(cow)).toBe(false);
});

test("Game objects can be removed immediately after they are created", () => {
   const position = new Point(400, 400);
   const cow = new Cow(position);

   cow.remove();
   
   // Check if the cow is in the board
   expect(Board.entityIsInBoard(cow)).toBe(false);
});

test("Game objects are moved inside the world if they are outside the world border", () => {
   const boardUnits = SETTINGS.BOARD_DIMENSIONS * SETTINGS.TILE_SIZE;
   
   const outsidePosition = new Point(boardUnits + 600, 0);

   const entity = new Cow(outsidePosition);
   expect(entity.position.x).toBeLessThan(boardUnits);

   entity.remove();
});