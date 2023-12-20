import { IEntityType, Point, TribeType } from "webgl-test-shared";
import Entity from "../../GameObject";
import { TotemBannerComponentArray, TribeComponentArray } from "../../components/ComponentArray";
import { TotemBannerPosition } from "../../components/TotemBannerComponent";

export const TRIBE_TOTEM_SIZE = 120;

const NUM_TOTEM_POSITIONS = [4, 6, 8];

const TRIBE_TOTEM_POSITIONS = new Array<TotemBannerPosition>();
for (let layerIdx = 0; layerIdx < 3; layerIdx++) {
   const numPositions = NUM_TOTEM_POSITIONS[layerIdx];
   for (let j = 0; j < numPositions; j++) {
      const angle = j / numPositions * 2 * Math.PI;
      TRIBE_TOTEM_POSITIONS.push({
         layer: layerIdx,
         direction: angle
      });
   }
}

export function createTribeTotem(position: Point, tribeType: TribeType): Entity {
   const totem = new Entity(position, IEntityType.tribeTotem);

   TribeComponentArray.addComponent(totem, {
      tribeType: tribeType,
      tribe: null
   });
   TotemBannerComponentArray.addComponent(totem, {
      banners: {},
      // @Speed: Garbage collection
      availableBannerPositions: Array.from(new Set(TRIBE_TOTEM_POSITIONS))
   })
   
   return totem;
}