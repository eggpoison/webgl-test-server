import Board from "./Board";
import { Point } from "webgl-test-shared";
import Cow from "./entities/mobs/Cow";
import { getEntityCount } from "./census";

test("Entities can be added to the census", () => {
   const numEntitiesBefore = getEntityCount("cow");

   const position = new Point(200, 200);
   const cow = new Cow(position);

   Board.pushJoinBuffer();

   const numEntitiesAfter = getEntityCount("cow");

   expect(numEntitiesAfter).toEqual(numEntitiesBefore + 1);

   // Clean up
   cow.remove();
   Board.forceRemoveEntity(cow);
});

test("Entities can be removed from the census", () => {
   const position = new Point(200, 200);
   const cow = new Cow(position);

   Board.pushJoinBuffer();

   const numEntitiesBefore = getEntityCount("cow");

   cow.remove();
   Board.forceRemoveEntity(cow);

   const numEntitiesAfter = getEntityCount("cow");

   expect(numEntitiesAfter).toEqual(numEntitiesBefore - 1);
});

test("Entities which aren't naturally spawned aren't counted towards the census", () => {
   const numEntitiesBefore = getEntityCount("cow");

   const position = new Point(200, 200);
   const cow = new Cow(position);

   Board.pushJoinBuffer();

   const numEntitiesAfter = getEntityCount("cow");

   expect(numEntitiesAfter).toEqual(numEntitiesBefore);

   // Clean up
   cow.remove();
   Board.forceRemoveEntity(cow);
});