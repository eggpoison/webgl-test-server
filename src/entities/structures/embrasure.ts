import { BuildingMaterial, COLLISION_BITS, DEFAULT_COLLISION_MASK, IEntityType, Point, StatusEffectConst } from "webgl-test-shared";
import Tribe from "../../Tribe";
import Entity from "../../Entity";
import { BuildingMaterialComponentArray, HealthComponentArray, TribeComponentArray } from "../../components/ComponentArray";
import { HealthComponent } from "../../components/HealthComponent";
import RectangularHitbox from "../../hitboxes/RectangularHitbox";
import { TribeComponent } from "../../components/TribeComponent";
import { StatusEffectComponent, StatusEffectComponentArray } from "../../components/StatusEffectComponent";
import { BuildingMaterialComponent } from "../../components/BuildingMaterialComponent";

const HITBOX_WIDTH = 20 - 0.05;
const HITBOX_HEIGHT = 20 - 0.05;

export const EMBRASURE_HEALTHS = [15, 45];

export function addEmbrasureHitboxes(entity: Entity): void {
   entity.addHitbox(new RectangularHitbox(entity, 0.4, -(64 - HITBOX_WIDTH) / 2 + 0.025, 0, HITBOX_WIDTH, HITBOX_HEIGHT));
   entity.addHitbox(new RectangularHitbox(entity, 0.4, (64 - HITBOX_WIDTH) / 2 - 0.025, 0, HITBOX_WIDTH, HITBOX_HEIGHT));
}

export function createEmbrasure(position: Point, tribe: Tribe, rotation: number, material: BuildingMaterial): Entity {
   const embrasure = new Entity(position, IEntityType.embrasure, COLLISION_BITS.default, DEFAULT_COLLISION_MASK);
   embrasure.rotation = rotation;

   addEmbrasureHitboxes(embrasure);
   
   HealthComponentArray.addComponent(embrasure, new HealthComponent(EMBRASURE_HEALTHS[material]));
   StatusEffectComponentArray.addComponent(embrasure, new StatusEffectComponent(StatusEffectConst.bleeding));
   TribeComponentArray.addComponent(embrasure, new TribeComponent(tribe));
   BuildingMaterialComponentArray.addComponent(embrasure, new BuildingMaterialComponent(material));

   return embrasure;
}

export function onEmbrasureRemove(embrasure: Entity): void {
   HealthComponentArray.removeComponent(embrasure);
   StatusEffectComponentArray.removeComponent(embrasure);
   TribeComponentArray.removeComponent(embrasure);
   BuildingMaterialComponentArray.removeComponent(embrasure);
}