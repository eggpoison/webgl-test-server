import { Point, SETTINGS } from "webgl-test-shared";
import { SERVER } from "./server";
import Cow from "./entities/mobs/Cow";

test("Game objects are moved inside the world if they are outside the world border", () => {
   SERVER;
   
   const boardUnits = SETTINGS.BOARD_DIMENSIONS * SETTINGS.TILE_SIZE;
   
   const outsidePosition = new Point(boardUnits + 600, 0);

   const entity = new Cow(outsidePosition);
   expect(entity.position.x).toBeLessThan(boardUnits);
});