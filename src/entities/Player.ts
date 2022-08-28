import { Point } from "webgl-test-shared";
import HealthComponent from "../entity-components/HealthComponent";
import HitboxComponent, { CircularHitbox } from "../entity-components/HitboxComponent";
import Entity from "./Entity";

const parseMovementHash = (movementHash: number): [boolean, boolean, boolean, boolean] => {
   const wIsPressed = (movementHash & 1) > 0;
   const aIsPressed = (movementHash & 2) > 0;
   const sIsPressed = (movementHash & 4) > 0;
   const dIsPressed = (movementHash & 8) > 0;

   return [wIsPressed, aIsPressed, sIsPressed, dIsPressed];
}

class Player extends Entity<"player"> {
   private static readonly MAX_HEALTH = 20;

   public readonly type = "player";

   /** Player nametag. Used when sending player data to the client */
   private readonly displayName: string;

   private static readonly ACCELERATION = 1000;
   private static readonly TERMINAL_VELOCITY = 300;

   private static readonly RADIUS = 32;
   private static readonly HITBOX: CircularHitbox = {
      type: "circular",
      radius: Player.RADIUS
   };

   constructor(position: Point, name: string) {
      super(position, null, null, 0, [
         new HealthComponent(Player.MAX_HEALTH, Player.MAX_HEALTH, 0),
         new HitboxComponent(Player.HITBOX)
      ]);

      this.displayName = name;
   }

   public getClientArgs(): [displayName: string] {
      return [this.displayName];
   }

   public updateMovementFromHash(movementHash: number): void {
      const [wIsPressed, aIsPressed, sIsPressed, dIsPressed] = parseMovementHash(movementHash);

      let xAcceleration = 0;
      let yAcceleration = 0;

      if (wIsPressed) {
         yAcceleration += Player.ACCELERATION;
      }
      if (aIsPressed) {
         xAcceleration -= Player.ACCELERATION;
      }
      if (sIsPressed) {
         yAcceleration -= Player.ACCELERATION;
      }
      if (dIsPressed) {
         xAcceleration += Player.ACCELERATION;
      }

      if (xAcceleration === 0 && yAcceleration === 0) {
         this.acceleration = null;
      } else {
         const acceleration = new Point(xAcceleration, yAcceleration).convertToVector();
         this.acceleration = acceleration;
         this.rotation = acceleration.direction;
         
         this.terminalVelocity = Player.TERMINAL_VELOCITY;
      }
   }
}

export default Player;