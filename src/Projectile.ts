import { Point, ProjectileType, SETTINGS } from "webgl-test-shared";
import _GameObject, { GameObjectEvents } from "./GameObject";
import Board from "./Board";
import Chunk from "./Chunk";

interface ProjectileEvents extends GameObjectEvents {}

class Projectile extends _GameObject<"projectile", ProjectileEvents> {
   public readonly i = "projectile" as const;
   
   protected readonly events = {
      on_destroy: [],
      enter_collision: [],
      during_collision: [],
      enter_entity_collision: [],
      during_entity_collision: []
   };

   public readonly type: ProjectileType;

   /** How many seconds the projectile can exist before automatically being removed */
   private lifetime: number;
   private age = 0;

   public readonly data: any;

   public tickCallback?: () => void;

   constructor(position: Point, type: ProjectileType, lifetime: number, data: any) {
      super(position);

      this.type = type;
      this.lifetime = lifetime;

      // By default, projectiles aren't affected by friction
      this.isAffectedByFriction = false;

      this.data = data;

      Board.addProjectileToJoinBuffer(this);
   }

   public tick(): void {
      super.tick();
      
      this.age += 1 / SETTINGS.TPS;
      if (this.age >= this.lifetime) {
         this.remove();
      }

      if (typeof this.tickCallback !== "undefined") {
         this.tickCallback();
      }
   }

   protected addToChunk(chunk: Chunk): void {
      super.addToChunk(chunk);
      chunk.projectiles.add(this);
   }

   public removeFromChunk(chunk: Chunk): void {
      super.removeFromChunk(chunk);
      chunk.projectiles.delete(this);
   }

   public remove(): void {
      if (!this.isRemoved) {
         super.remove();
         Board.addProjectileToRemoveBuffer(this);
         Board.removeProjectileFromJoinBuffer(this);
      }
   }
}

export default Projectile;