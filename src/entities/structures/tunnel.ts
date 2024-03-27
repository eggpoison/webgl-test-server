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
import CircularHitbox from "../../hitboxes/CircularHitbox";

const HITBOX_WIDTH = 8 - 0.05;
const HITBOX_HEIGHT = 64 - 0.05;
const THIN_HITBOX_WIDTH = 0.1;

export const TUNNEL_HEALTHS = [25, 75];

export function createTunnelHitboxes(entity: Entity): ReadonlyArray<CircularHitbox | RectangularHitbox> {
   const hitboxes = new Array<CircularHitbox | RectangularHitbox>();
   
   // Soft hitboxes
   hitboxes.push(new RectangularHitbox(entity.position.x, entity.position.y, 1, -32 + HITBOX_WIDTH / 2, 0, HitboxCollisionTypeConst.soft, entity.getNextHitboxLocalID(), entity.rotation, HITBOX_WIDTH, HITBOX_HEIGHT, 0));
   hitboxes.push(new RectangularHitbox(entity.position.x, entity.position.y, 1, 32 - HITBOX_WIDTH / 2, 0, HitboxCollisionTypeConst.soft, entity.getNextHitboxLocalID(), entity.rotation, HITBOX_WIDTH, HITBOX_HEIGHT, 0));

   // Hard hitboxes
   // entity.addHitbox(new RectangularHitbox(entity, 1, -32 + THIN_HITBOX_WIDTH, 0, HitboxCollisionTypeConst.hard, THIN_HITBOX_WIDTH, HITBOX_HEIGHT));
   // entity.addHitbox(new RectangularHitbox(entity, 1, 32 - THIN_HITBOX_WIDTH, 0, HitboxCollisionTypeConst.hard, THIN_HITBOX_WIDTH, HITBOX_HEIGHT));
   // @Temporary
   hitboxes.push(new RectangularHitbox(entity.position.x, entity.position.y, 1, -32.5, 0, HitboxCollisionTypeConst.hard, entity.getNextHitboxLocalID(), entity.rotation, THIN_HITBOX_WIDTH, HITBOX_HEIGHT, 0));
   hitboxes.push(new RectangularHitbox(entity.position.x, entity.position.y, 1, 32.5, 0, HitboxCollisionTypeConst.hard, entity.getNextHitboxLocalID(), entity.rotation, THIN_HITBOX_WIDTH, HITBOX_HEIGHT, 0));

   return hitboxes;
}

export function createTunnel(position: Point, rotation: number, tribe: Tribe, material: BuildingMaterial): Entity {
   const tunnel = new Entity(position, IEntityType.tunnel, COLLISION_BITS.default, DEFAULT_COLLISION_MASK);
   tunnel.rotation = rotation;

   const hitboxes = createTunnelHitboxes(tunnel);
   for (let i = 0; i < hitboxes.length; i++) {
      tunnel.addHitbox(hitboxes[i]);
   }
   
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