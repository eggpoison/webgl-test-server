import { COLLISION_BITS, DEFAULT_COLLISION_MASK, IEntityType, Point, StatusEffectConst } from "webgl-test-shared";
import Entity from "../../Entity";
import { HealthComponentArray, TotemBannerComponentArray, TribeComponentArray } from "../../components/ComponentArray";
import { TotemBannerPosition } from "../../components/TotemBannerComponent";
import CircularHitbox from "../../hitboxes/CircularHitbox";
import { HealthComponent } from "../../components/HealthComponent";
import { StatusEffectComponent, StatusEffectComponentArray } from "../../components/StatusEffectComponent";
import Tribe from "../../Tribe";
import { TribeComponent } from "../../components/TribeComponent";

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

export function createTribeTotem(position: Point, tribe: Tribe): Entity {
   const totem = new Entity(position, IEntityType.tribeTotem, COLLISION_BITS.default, DEFAULT_COLLISION_MASK);
   
   const hitbox = new CircularHitbox(totem, 2.2, 0, 0, TRIBE_TOTEM_SIZE / 2);
   totem.addHitbox(hitbox);

   HealthComponentArray.addComponent(totem, new HealthComponent(50));
   StatusEffectComponentArray.addComponent(totem, new StatusEffectComponent(StatusEffectConst.poisoned));
   TribeComponentArray.addComponent(totem, new TribeComponent(tribe));
   TotemBannerComponentArray.addComponent(totem, {
      banners: {},
      // @Speed: Garbage collection
      availableBannerPositions: Array.from(new Set(TRIBE_TOTEM_POSITIONS))
   });

   tribe.setTotem(totem);
   
   return totem;
}

export function onTribeTotemDeath(totem: Entity): void {
   const tribeComponent = TribeComponentArray.getComponent(totem.id);
   tribeComponent.tribe!.clearTotem();
}

export function onTribeTotemRemove(totem: Entity): void {
   HealthComponentArray.removeComponent(totem);
   StatusEffectComponentArray.removeComponent(totem);
   TribeComponentArray.removeComponent(totem);
   TotemBannerComponentArray.removeComponent(totem);
}