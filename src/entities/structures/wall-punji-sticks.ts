import { COLLISION_BITS, DEFAULT_COLLISION_MASK, IEntityType, Point, StatusEffectConst } from "webgl-test-shared";
import Entity from "../../Entity";
import RectangularHitbox from "../../hitboxes/RectangularHitbox";
import { HealthComponentArray, TribeComponentArray } from "../../components/ComponentArray";
import { HealthComponent } from "../../components/HealthComponent";
import { StatusEffectComponent, StatusEffectComponentArray } from "../../components/StatusEffectComponent";
import Tribe from "../../Tribe";
import { TribeComponent } from "../../components/TribeComponent";

const HITBOX_WIDTH = 56 - 0.05;
const HITBOX_HEIGHT = 32 - 0.05;

export function createWallPunjiSticks(position: Point, tribe: Tribe | null): Entity {
   const punjiSticks = new Entity(position, IEntityType.wallPunjiSticks, COLLISION_BITS.default, DEFAULT_COLLISION_MASK);

   // @Hack: mass
   punjiSticks.addHitbox(new RectangularHitbox(punjiSticks, Number.EPSILON, 0, 0, HITBOX_WIDTH, HITBOX_HEIGHT));

   HealthComponentArray.addComponent(punjiSticks, new HealthComponent(10));
   StatusEffectComponentArray.addComponent(punjiSticks, new StatusEffectComponent(StatusEffectConst.bleeding | StatusEffectConst.poisoned));
   TribeComponentArray.addComponent(punjiSticks, new TribeComponent(tribe));

   return punjiSticks;
}

export function onWallPunjiSticksRemove(punjiSticks: Entity): void {
   HealthComponentArray.removeComponent(punjiSticks);
   StatusEffectComponentArray.removeComponent(punjiSticks);
   TribeComponentArray.removeComponent(punjiSticks);
}