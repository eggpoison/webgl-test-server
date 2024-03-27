import { BuildingMaterial, COLLISION_BITS, DEFAULT_COLLISION_MASK, HitboxCollisionTypeConst, IEntityType, Point, StatusEffectConst } from "webgl-test-shared";
import Tribe from "../../Tribe";
import Entity from "../../Entity";
import { BuildingMaterialComponentArray, HealthComponentArray, TribeComponentArray, TunnelComponentArray } from "../../components/ComponentArray";
import { HealthComponent } from "../../components/HealthComponent";
import { StatusEffectComponent, StatusEffectComponentArray } from "../../components/StatusEffectComponent";
import { TribeComponent } from "../../components/TribeComponent";
import RectangularHitbox from "../../hitboxes/RectangularHitbox";
import { TunnelComponent } from "../../components/TunnelComponent";
import { BuildingMaterialComponent } from "../../components/BuildingMaterialComponent";

const HITBOX_WIDTH = 8 - 0.05;
const HITBOX_HEIGHT = 64 - 0.05;
const THIN_HITBOX_WIDTH = 0.1;

export const TUNNEL_HEALTHS = [25, 75];

export function addTunnelHitboxes(entity: Entity): void {
   // Soft hitboxes
   entity.addHitbox(new RectangularHitbox(entity, 1, -32 + HITBOX_WIDTH / 2, 0, HitboxCollisionTypeConst.soft, HITBOX_WIDTH, HITBOX_HEIGHT));
   entity.addHitbox(new RectangularHitbox(entity, 1, 32 - HITBOX_WIDTH / 2, 0, HitboxCollisionTypeConst.soft, HITBOX_WIDTH, HITBOX_HEIGHT));

   // Hard hitboxes
   // entity.addHitbox(new RectangularHitbox(entity, 1, -32 + THIN_HITBOX_WIDTH, 0, HitboxCollisionTypeConst.hard, THIN_HITBOX_WIDTH, HITBOX_HEIGHT));
   // entity.addHitbox(new RectangularHitbox(entity, 1, 32 - THIN_HITBOX_WIDTH, 0, HitboxCollisionTypeConst.hard, THIN_HITBOX_WIDTH, HITBOX_HEIGHT));
   // @Temporary
   entity.addHitbox(new RectangularHitbox(entity, 1, -32.5, 0, HitboxCollisionTypeConst.hard, THIN_HITBOX_WIDTH, HITBOX_HEIGHT));
   entity.addHitbox(new RectangularHitbox(entity, 1, 32.5, 0, HitboxCollisionTypeConst.hard, THIN_HITBOX_WIDTH, HITBOX_HEIGHT));
}

export function createTunnel(position: Point, rotation: number, tribe: Tribe, material: BuildingMaterial): Entity {
   const tunnel = new Entity(position, IEntityType.tunnel, COLLISION_BITS.default, DEFAULT_COLLISION_MASK);
   tunnel.rotation = rotation;

   addTunnelHitboxes(tunnel);
   
   HealthComponentArray.addComponent(tunnel, new HealthComponent(TUNNEL_HEALTHS[material]));
   StatusEffectComponentArray.addComponent(tunnel, new StatusEffectComponent(StatusEffectConst.bleeding));
   TribeComponentArray.addComponent(tunnel, new TribeComponent(tribe));
   TunnelComponentArray.addComponent(tunnel, new TunnelComponent());
   BuildingMaterialComponentArray.addComponent(tunnel, new BuildingMaterialComponent(material));
   
   return tunnel;
}

export function onTunnelJoin(tunnel: Entity): void {
   const tribeComponent = TribeComponentArray.getComponent(tunnel.id);
   tribeComponent.tribe.addBuilding(tunnel);
}

export function onTunnelRemove(tunnel: Entity): void {
   const tribeComponent = TribeComponentArray.getComponent(tunnel.id);
   tribeComponent.tribe.removeBuilding(tunnel);

   HealthComponentArray.removeComponent(tunnel);
   StatusEffectComponentArray.removeComponent(tunnel);
   TribeComponentArray.removeComponent(tunnel);
   TunnelComponentArray.removeComponent(tunnel);
   BuildingMaterialComponentArray.removeComponent(tunnel);
}