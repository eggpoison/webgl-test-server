import { DoorToggleType, SettingsConst, angle, lerp } from "webgl-test-shared";
import Entity from "../Entity";
import { DoorComponentArray } from "./ComponentArray";

const DOOR_SWING_SPEED = 5 / SettingsConst.TPS;

export class DoorComponent {
   public readonly originX: number;
   public readonly originY: number;
   public readonly closedRotation: number;
   
   public toggleType = DoorToggleType.none;
   public doorOpenProgress = 0;

   constructor(originX: number, originY: number, closedRotation: number) {
      this.originX = originX;
      this.originY = originY;
      this.closedRotation = closedRotation;
   }
}

const doorHalfDiagonalLength = Math.sqrt(16 * 16 + 64 * 64) / 2;
const angleToCenter = angle(16, 64);

const updateDoorOpenProgress = (door: Entity, doorComponent: DoorComponent): void => {
   const rotation = doorComponent.closedRotation + lerp(0, -Math.PI/2 + 0.1, doorComponent.doorOpenProgress);
   
   // Rotate around the top left corner of the door
   const offsetDirection = rotation + Math.PI/2 + angleToCenter;
   const xOffset = doorHalfDiagonalLength * Math.sin(offsetDirection) - doorHalfDiagonalLength * Math.sin(doorComponent.closedRotation + Math.PI/2 + angleToCenter);
   const yOffset = doorHalfDiagonalLength * Math.cos(offsetDirection) - doorHalfDiagonalLength * Math.cos(doorComponent.closedRotation + Math.PI/2 + angleToCenter);

   door.position.x = doorComponent.originX + xOffset;
   door.position.y = doorComponent.originY + yOffset;
   door.rotation = rotation;
   door.hitboxesAreDirty = true;
}

export function tickDoorComponent(door: Entity): void {
   const doorComponent = DoorComponentArray.getComponent(door);
   
   switch (doorComponent.toggleType) {
      case DoorToggleType.open: {
         doorComponent.doorOpenProgress += DOOR_SWING_SPEED;
         if (doorComponent.doorOpenProgress >= 1) {
            doorComponent.doorOpenProgress = 1;
            doorComponent.toggleType = DoorToggleType.none;
         }
         updateDoorOpenProgress(door, doorComponent);
         break;
      }
      case DoorToggleType.close: {
         doorComponent.doorOpenProgress -= DOOR_SWING_SPEED;
         if (doorComponent.doorOpenProgress <= 0) {
            doorComponent.doorOpenProgress = 0;
            doorComponent.toggleType = DoorToggleType.none;
         }
         updateDoorOpenProgress(door, doorComponent);
         break;
      }
   }
}

export function toggleDoor(door: Entity): void {
   const doorComponent = DoorComponentArray.getComponent(door);

   // Don't toggle if already in the middle of opening/closing
   if (doorComponent.toggleType !== DoorToggleType.none) {
      return;
   }

   if (doorComponent.doorOpenProgress === 0) {
      // Open the door
      doorComponent.toggleType = DoorToggleType.open;
   } else {
      // Close the door
      doorComponent.toggleType = DoorToggleType.close;
   }
}