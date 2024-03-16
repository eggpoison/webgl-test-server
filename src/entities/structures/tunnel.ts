import { BuildingMaterial, COLLISION_BITS, DEFAULT_COLLISION_MASK, IEntityType, Point, StatusEffectConst } from "webgl-test-shared";
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

export const TUNNEL_HEALTHS = [25, 75];

export function addTunnelHitboxes(entity: Entity): void {
   entity.addHitbox(new RectangularHitbox(entity, 1, -32 + HITBOX_WIDTH / 2, 0, HITBOX_WIDTH, HITBOX_HEIGHT));
   entity.addHitbox(new RectangularHitbox(entity, 1, 32 - HITBOX_WIDTH / 2, 0, HITBOX_WIDTH, HITBOX_HEIGHT));
}

export function createTunnel(position: Point, tribe: Tribe, rotation: number, material: BuildingMaterial): Entity {
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

export function onTunnelRemove(tunnel: Entity): void {
   HealthComponentArray.removeComponent(tunnel);
   StatusEffectComponentArray.removeComponent(tunnel);
   TribeComponentArray.removeComponent(tunnel);
   TunnelComponentArray.removeComponent(tunnel);
   BuildingMaterialComponentArray.removeComponent(tunnel);
}