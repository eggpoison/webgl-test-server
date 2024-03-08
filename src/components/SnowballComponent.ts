import { SnowballComponentData, SnowballSize, randFloat, randSign } from "webgl-test-shared";
import Entity from "../Entity";
import { SnowballComponentArray } from "./ComponentArray";

export class SnowballComponent {
   public readonly yetiID: number;
   public readonly size: SnowballSize;
   public readonly lifetimeTicks: number;

   public angularVelocity = randFloat(1, 2) * Math.PI * randSign();

   constructor(yetiID: number, size: SnowballSize, lifetime: number) {
      this.yetiID = yetiID;
      this.size = size;
      this.lifetimeTicks = lifetime;
   }
}

export function serialiseSnowballComponent(snowball: Entity): SnowballComponentData {
   const snowballComponent = SnowballComponentArray.getComponent(snowball.id);
   return {
      size: snowballComponent.size
   };
}