import { Point, SETTINGS, angle, lerp } from "webgl-test-shared";
import Entity from "../Entity";
import { DoorComponentArray } from "./ComponentArray";
import RectangularHitbox from "../hitboxes/RectangularHitbox";

const DOOR_SWING_SPEED = 2 / SETTINGS.TPS;

enum DoorToggleType {
   none,
   close,
   open
}

export class DoorComponent {
   public readonly closedRotation: number;
   
   public toggleType = DoorToggleType.none;
   public doorOpenProgress = 0;

   constructor(closedRotation: number) {
      this.closedRotation = closedRotation;
   }
}

const updateDoorOpenProgress = (door: Entity, doorComponent: DoorComponent): void => {
   // @Incomplete: We would update the position of the door as well.

   // @Speed
   // @Speed
   // @Speed
   
   const rotation = doorComponent.closedRotation + lerp(0, Math.PI/2, doorComponent.doorOpenProgress);
   door.rotation = rotation;

   const hitbox = door.hitboxes[0] as RectangularHitbox;

   const doorWidth = 64;
   const doorHeight = 16;
   
   const startX = door.position.x - doorWidth / 2;
   const startY = door.position.y - doorHeight / 2;

   const direction = rotation - doorComponent.closedRotation + angle(-doorWidth, -doorHeight);
   // const direction = rotation + angle(-doorWidth, -doorHeight);
   // const direction = angle(-doorWidth, -doorHeight);
   const magnitude = Math.sqrt(doorWidth * doorWidth / 4 + doorHeight * doorHeight / 4);
   const endX = door.position.x + magnitude * Math.sin(direction);
   const endY = door.position.y + magnitude * Math.cos(direction);

   const offsetX = startX - endX;
   const offsetY = startY - endY;
   const offset = new Point(offsetX, offsetY).convertToVector();
   // offset.direction -= rotation;
   console.log(startX, endX, startY, endY);
   console.log(offsetX, offsetY);
   // hitbox.offset.x = offsetX;
   // hitbox.offset.y = offsetY;
   hitbox.offset.x = offset.convertToPoint().x;
   hitbox.offset.y = offset.convertToPoint().y;

   // hitbox.offset.x = 0;
   // hitbox.offset.y = 0;
   // // const doorRotation = lerp(Math.PI/2, 0, this.doorSwingAmount);
   // const doorRotation = rotation + Math.PI/2;
   // // const rotationOffset = new Point(0, WorkerHut.DOOR_HEIGHT / 2 - 2).convertToVector();
   // const rotationOffset = new Point(0, 64 / 2 - 2).convertToVector();
   // rotationOffset.direction = doorRotation;
   // hitbox.offset.add(rotationOffset.convertToPoint());

   // hitbox.rotation = rotation;
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