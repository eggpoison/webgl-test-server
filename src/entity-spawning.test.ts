import { Point } from "webgl-test-shared";
import { SERVER } from "./server"
import Cow from "./entities/mobs/Cow";
import { MIN_SPAWN_DISTANCE, getNumEntitiesInCensus, spawnPositionIsValid } from "./entity-spawning";

test("Entities can be added to the census", () => {
   SERVER;

   const numEntitiesBefore = getNumEntitiesInCensus("cow");

   const position = new Point(200, 200);
   const cow = new Cow(position, true);

   SERVER.board.forcePushGameObjectFromJoinBuffer(cow);

   const numEntitiesAfter = getNumEntitiesInCensus("cow");

   expect(numEntitiesAfter).toEqual(numEntitiesBefore + 1);

   // Clean up
   cow.remove();
   SERVER.board.forceRemoveGameObject(cow);
});

test("Entities can be removed from the census", () => {
   SERVER;

   const position = new Point(200, 200);
   const cow = new Cow(position, true);

   SERVER.board.forcePushGameObjectFromJoinBuffer(cow);

   const numEntitiesBefore = getNumEntitiesInCensus("cow");

   cow.remove();
   SERVER.board.forceRemoveGameObject(cow);

   const numEntitiesAfter = getNumEntitiesInCensus("cow");

   expect(numEntitiesAfter).toEqual(numEntitiesBefore - 1);
});

test("Entities which aren't naturally spawned aren't counted towards the census", () => {
   SERVER;

   const numEntitiesBefore = getNumEntitiesInCensus("cow");

   const position = new Point(200, 200);
   const cow = new Cow(position, false);

   SERVER.board.forcePushGameObjectFromJoinBuffer(cow);

   const numEntitiesAfter = getNumEntitiesInCensus("cow");

   expect(numEntitiesAfter).toEqual(numEntitiesBefore);

   // Clean up
   cow.remove();
   SERVER.board.forceRemoveGameObject(cow);
});

test("Entities can't be spawned too close to each other", () => {
   SERVER;

   const position = new Point(200, 200);
   const cow = new Cow(position, false);

   SERVER.board.forcePushGameObjectFromJoinBuffer(cow);

   expect(spawnPositionIsValid(position)).toBe(false);

   // Clean up
   cow.remove();
   SERVER.board.forceRemoveGameObject(cow);
});

test("Entities can be spawned far away from each other", () => {
   SERVER;

   const position1 = new Point(200, 200);
   const cow = new Cow(position1, false);

   SERVER.board.forcePushGameObjectFromJoinBuffer(cow);

   const position2 = new Point(position1.x + MIN_SPAWN_DISTANCE + 10, position1.y);
   expect(spawnPositionIsValid(position2)).toBe(true);

   // Clean up
   cow.remove();
   SERVER.board.forceRemoveGameObject(cow);
})