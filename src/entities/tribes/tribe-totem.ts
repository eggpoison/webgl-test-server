import { COLLISION_BITS, DEFAULT_COLLISION_MASK, IEntityType, Point, TribeType } from "webgl-test-shared";
import Entity from "../../Entity";
import { HealthComponentArray, StatusEffectComponentArray, TotemBannerComponentArray, TribeComponentArray } from "../../components/ComponentArray";
import { TotemBannerPosition } from "../../components/TotemBannerComponent";
import CircularHitbox from "../../hitboxes/CircularHitbox";
import { HealthComponent } from "../../components/HealthComponent";
import { StatusEffectComponent } from "../../components/StatusEffectComponent";

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
   const totem = new Entity(position, IEntityType.tribeTotem, COLLISION_BITS.other, DEFAULT_COLLISION_MASK);
   
   const hitbox = new CircularHitbox(totem, 0, 0, TRIBE_TOTEM_SIZE / 2);
   totem.addHitbox(hitbox);

   HealthComponentArray.addComponent(totem, new HealthComponent(50));
   StatusEffectComponentArray.addComponent(totem, new StatusEffectComponent());
   TribeComponentArray.addComponent(totem, {
      tribeType: tribeType,
      tribe: null
   });
   TotemBannerComponentArray.addComponent(totem, {
      banners: {},
      // @Speed: Garbage collection
      availableBannerPositions: Array.from(new Set(TRIBE_TOTEM_POSITIONS))
   });

   totem.isStatic = true;
   
   return totem;
}

export function onTribeTotemRemove(totem: Entity): void {
   HealthComponentArray.removeComponent(totem);
   StatusEffectComponentArray.removeComponent(totem);
   TribeComponentArray.removeComponent(totem);
   TotemBannerComponentArray.removeComponent(totem);
}