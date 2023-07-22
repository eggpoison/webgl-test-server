import { Point, SETTINGS } from "webgl-test-shared";
import Cow from "./entities/mobs/Cow";
import Game from "./Game";

test("Game objects are moved inside the world if they are outside the world border", () => {
   Game;
   
   const boardUnits = SETTINGS.BOARD_DIMENSIONS * SETTINGS.TILE_SIZE;
   
   const outsidePosition = new Point(boardUnits + 600, 0);

   const entity = new Cow(outsidePosition);
   expect(entity.position.x).toBeLessThan(boardUnits);
});