import { SpikesComponentData } from "webgl-test-shared";
import Entity from "../Entity";
import { SpikesComponentArray } from "./ComponentArray";

export class SpikesComponent {
   public readonly attachedWallID: number;

   constructor(attachedWallID: number) {
      this.attachedWallID = attachedWallID;
   }
}

export function serialiseSpikesComponent(spikes: Entity): SpikesComponentData {
   const spikesComponent = SpikesComponentArray.getComponent(spikes.id);
   return {
      attachedWallID: spikesComponent.attachedWallID
   };
}