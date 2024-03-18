import { DoorToggleType, HitboxCollisionTypeConst, SettingsConst, TunnelComponentData, angle, lerp } from "webgl-test-shared";
import Entity from "../Entity";
import { TunnelComponentArray } from "./ComponentArray";
import { PhysicsComponentArray } from "./PhysicsComponent";
import RectangularHitbox from "../hitboxes/RectangularHitbox";

const DOOR_HITBOX_MASS = 1;
const DOOR_HITBOX_WIDTH = 48;
const DOOR_HITBOX_HEIGHT = 16;
const DOOR_HITBOX_OFFSET = 28;

// @Cleanup: All the door toggling logic is stolen from DoorComponent.ts

const enum DoorType {
   top,
   bottom
}

const DOOR_SWING_SPEED = 5 / SettingsConst.TPS;

export class TunnelComponent {
   public doorBitset = 0;
   /** Index of the first hitbox to be added to the tunnel in the hitboxes array */
   public firstDoorHitboxIndex = 0;

   public topDoorToggleType = DoorToggleType.none;
   public topDoorOpenProgress = 0;

   public bottomDoorToggleType = DoorToggleType.none;
   public bottomDoorOpenProgress = 0;
}

const doorHalfDiagonalLength = Math.sqrt(16 * 16 + 64 * 64) / 2;
const angleToCenter = angle(16, 64);

const updateDoorOpenProgress = (tunnel: Entity, tunnelComponent: TunnelComponent, doorType: DoorType): void => {
   const openProgress = doorType === DoorType.top ? tunnelComponent.topDoorOpenProgress : tunnelComponent.bottomDoorOpenProgress;
   const rotation = tunnel.rotation + lerp(0, -Math.PI/2 + 0.1, openProgress);
   
   // Rotate around the top left corner of the door
   const offsetDirection = rotation + Math.PI/2 + angleToCenter;
   const xOffset = doorHalfDiagonalLength * Math.sin(offsetDirection) - doorHalfDiagonalLength * Math.sin(tunnel.rotation + Math.PI/2 + angleToCenter);
   const yOffset = doorHalfDiagonalLength * Math.cos(offsetDirection) - doorHalfDiagonalLength * Math.cos(tunnel.rotation + Math.PI/2 + angleToCenter);

   tunnel.position.x = tunnel.position.x + xOffset;
   tunnel.position.y = tunnel.position.y + yOffset;
   tunnel.rotation = rotation;
}

export function tickTunnelComponent(tunnel: Entity): void {
   const tunnelComponent = TunnelComponentArray.getComponent(tunnel.id);

   const physicsComponent = PhysicsComponentArray.getComponent(tunnel.id);
   physicsComponent.hitboxesAreDirty = true;
}

export function serialiseTunnelComponent(tunnel: Entity): TunnelComponentData {
   const tunnelComponent = TunnelComponentArray.getComponent(tunnel.id);

   return {
      doorBitset: tunnelComponent.doorBitset
   };
}

export function updateTunnelDoorBitset(tunnel: Entity, doorBitset: number): void {
   const tunnelComponent = TunnelComponentArray.getComponent(tunnel.id);

   if ((tunnelComponent.doorBitset & 0b01) !== (doorBitset & 0b01)) {
      // Add top door hitbox
      tunnel.addHitbox(new RectangularHitbox(tunnel, DOOR_HITBOX_MASS, 0, DOOR_HITBOX_OFFSET, HitboxCollisionTypeConst.soft, DOOR_HITBOX_WIDTH, DOOR_HITBOX_HEIGHT));
   }
   if ((tunnelComponent.doorBitset & 0b10) !== (doorBitset & 0b10)) {
      // Add bottom door hitbox
      tunnel.addHitbox(new RectangularHitbox(tunnel, DOOR_HITBOX_MASS, 0, -DOOR_HITBOX_OFFSET, HitboxCollisionTypeConst.soft, DOOR_HITBOX_WIDTH, DOOR_HITBOX_HEIGHT));
      
      if (tunnelComponent.doorBitset === 0b00) {
         tunnelComponent.firstDoorHitboxIndex = 1;
      }
   }

   tunnelComponent.doorBitset = doorBitset;
}