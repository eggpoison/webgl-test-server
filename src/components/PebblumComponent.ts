import { PebblumComponentData } from "webgl-test-shared";
import Entity from "../Entity";

export class PebblumComponent {
   public targetEntityID: number;
   
   constructor(targetEntityID: number) {
      this.targetEntityID = targetEntityID
   }
}

export function serialisePebblumComponent(_entity: Entity): PebblumComponentData {
   return {};
}