import { BuildingMaterial, COLLISION_BITS, DEFAULT_COLLISION_MASK, HitboxCollisionTypeConst, IEntityType, Point, StatusEffectConst } from "webgl-test-shared";
import Tribe from "../../Tribe";
import Entity from "../../Entity";
import { ArrowComponentArray, BuildingMaterialComponentArray, HealthComponentArray, TribeComponentArray } from "../../components/ComponentArray";
import { HealthComponent } from "../../components/HealthComponent";
import RectangularHitbox from "../../hitboxes/RectangularHitbox";
import { TribeComponent } from "../../components/TribeComponent";
import { StatusEffectComponent, StatusEffectComponentArray } from "../../components/StatusEffectComponent";
import { BuildingMaterialComponent } from "../../components/BuildingMaterialComponent";
import CircularHitbox from "../../hitboxes/CircularHitbox";

const VERTICAL_HITBOX_WIDTH = 12 - 0.05;
const VERTICAL_HITBOX_HEIGHT = 20 - 0.05;

const HORIZONTAL_HITBOX_WIDTH = 24 - 0.05;
const HORIZONTAL_HITBOX_HEIGHT = 16 - 0.05;

export const EMBRASURE_HEALTHS = [15, 45];

export function createEmbrasureHitboxes(entity: Entity): ReadonlyArray<CircularHitbox | RectangularHitbox> {
   const hitboxes = new Array<CircularHitbox | RectangularHitbox>();
   
   // Add the two vertical hitboxes (can stop arrows)
   hitboxes.push(new RectangularHitbox(entity.position.x, entity.position.y, 0.4, -(64 - VERTICAL_HITBOX_WIDTH) / 2 + 0.025, 0, HitboxCollisionTypeConst.hard, entity.getNextHitboxLocalID(), entity.rotation, VERTICAL_HITBOX_WIDTH, VERTICAL_HITBOX_HEIGHT, 0));
   hitboxes.push(new RectangularHitbox(entity.position.x, entity.position.y, 0.4, (64 - VERTICAL_HITBOX_WIDTH) / 2 - 0.025, 0, HitboxCollisionTypeConst.hard, entity.getNextHitboxLocalID(), entity.rotation, VERTICAL_HITBOX_WIDTH, VERTICAL_HITBOX_HEIGHT, 0));

   // Add the two horizontal hitboxes (cannot stop arrows)
   hitboxes.push(new RectangularHitbox(entity.position.x, entity.position.y, 0.4, -(64 - HORIZONTAL_HITBOX_WIDTH) / 2 + 0.025, 0, HitboxCollisionTypeConst.hard, entity.getNextHitboxLocalID(), entity.rotation, HORIZONTAL_HITBOX_WIDTH, HORIZONTAL_HITBOX_HEIGHT, 0));
   hitboxes.push(new RectangularHitbox(entity.position.x, entity.position.y, 0.4, (64 - HORIZONTAL_HITBOX_WIDTH) / 2 + 0.025, 0, HitboxCollisionTypeConst.hard, entity.getNextHitboxLocalID(), entity.rotation, HORIZONTAL_HITBOX_WIDTH, HORIZONTAL_HITBOX_HEIGHT, 0));

   return hitboxes;
}

export function createEmbrasure(position: Point, rotation: number, tribe: Tribe, material: BuildingMaterial): Entity {
   const embrasure = new Entity(position, IEntityType.embrasure, COLLISION_BITS.default, DEFAULT_COLLISION_MASK);
   embrasure.rotation = rotation;

   const hitboxes = createEmbrasureHitboxes(embrasure);
   for (let i = 0; i < hitboxes.length; i++) {
      embrasure.addHitbox(hitboxes[i]);
   }
   
   HealthComponentArray.addComponent(embrasure, new HealthComponent(EMBRASURE_HEALTHS[material]));
   StatusEffectComponentArray.addComponent(embrasure, new StatusEffectComponent(StatusEffectConst.bleeding));
   TribeComponentArray.addComponent(embrasure, new TribeComponent(tribe));
   BuildingMaterialComponentArray.addComponent(embrasure, new BuildingMaterialComponent(material));

   return embrasure;
}

export function onEmbrasureJoin(embrasure: Entity): void {
   const tribeComponent = TribeComponentArray.getComponent(embrasure.id);
   tribeComponent.tribe.addBuilding(embrasure);
}

export function onEmbrasureCollision(embrasure: Entity, collidingEntity: Entity, pushedHitboxIdx: number): void {
   if (collidingEntity.type === IEntityType.woodenArrowProjectile) {
      const arrowComponent = ArrowComponentArray.getComponent(collidingEntity.id);
      if (arrowComponent.ignoreFriendlyBuildings) {
         return;
      }

      if (pushedHitboxIdx <= 1) {
         collidingEntity.remove();
      }
   }
}

export function onEmbrasureRemove(embrasure: Entity): void {
   const tribeComponent = TribeComponentArray.getComponent(embrasure.id);
   tribeComponent.tribe.removeBuilding(embrasure);

   HealthComponentArray.removeComponent(embrasure);
   StatusEffectComponentArray.removeComponent(embrasure);
   TribeComponentArray.removeComponent(embrasure);
   BuildingMaterialComponentArray.removeComponent(embrasure);
}