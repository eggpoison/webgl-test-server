import { Point } from "webgl-test-shared";
import HealthComponent from "../entity-components/HealthComponent";
import Entity from "./Entity";

class Cow extends Entity {
   private static readonly MAX_HEALTH = 10;

   constructor(position: Point) {
      super(position, null, null, [
         new HealthComponent(Cow.MAX_HEALTH, Cow.MAX_HEALTH, 0)
      ]);
   }
}

export default Cow;