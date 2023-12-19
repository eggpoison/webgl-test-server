import { Point } from "webgl-test-shared";
import Entity, { IEntityType } from "../GameObject";
import RectangularHitbox from "../hitboxes/RectangularHitbox";

const WORKBENCH_SIZE = 80;

export function createWorkbench(position: Point): Entity {
   const workbench = new Entity(position, IEntityType.workbench);

   const hitbox = new RectangularHitbox(workbench, 0, 0, WORKBENCH_SIZE, WORKBENCH_SIZE);
   workbench.addHitbox(hitbox);
   
   return workbench;
}