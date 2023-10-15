import { Point } from "webgl-test-shared";
import Cow from "./entities/mobs/Cow";
import { MIN_SPAWN_DISTANCE, spawnPositionIsValid } from "./entity-spawning";
import Board from "./Board";

test("Entities can't be spawned too close to each other", () => {
   const position = new Point(200, 200);
   const cow = new Cow(position);

   Board.pushJoinBuffer();

   expect(spawnPositionIsValid(position)).toBe(false);

   // Clean up
   cow.remove();
   Board.forceRemoveEntity(cow);
});

test("Entities can be spawned far away from each other", () => {
   const position1 = new Point(200, 200);
   const cow = new Cow(position1);

   Board.pushJoinBuffer();

   const position2 = new Point(position1.x + MIN_SPAWN_DISTANCE + 10, position1.y);
   expect(spawnPositionIsValid(position2)).toBe(true);

   // Clean up
   cow.remove();
   Board.forceRemoveEntity(cow);
})