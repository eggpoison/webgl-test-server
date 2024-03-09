import { HutComponentData } from "webgl-test-shared";
import Board from "../Board";
import Entity from "../Entity";
import { HutComponentArray } from "./ComponentArray";

export class HutComponent {
   public lastDoorSwingTicks = Board.ticks;
}

export function serialiseHutComponent(entity: Entity): HutComponentData {
   const hutComponent = HutComponentArray.getComponent(entity.id);
   return {
      lastDoorSwingTicks: hutComponent.lastDoorSwingTicks
   };
}