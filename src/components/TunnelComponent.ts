import { TunnelComponentData } from "webgl-test-shared";
import Entity from "../Entity";
import { TunnelComponentArray } from "./ComponentArray";

export class TunnelComponent {
   public doorBitset = 0;
}

export function serialiseTunnelComponent(entity: Entity): TunnelComponentData {
   const tunnelComponent = TunnelComponentArray.getComponent(entity.id);

   return {
      doorBitset: tunnelComponent.doorBitset
   };
}