import { Point, ProjectileType, SETTINGS } from "webgl-test-shared";
import _GameObject, { GameObjectEvents } from "./GameObject";

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

   public readonly mass = 1;

   public readonly type: ProjectileType;

   /** How many seconds the projectile can exist before automatically being removed */
   private lifetime: number;
   private age = 0;

   public readonly data: number;

   public tickCallback?: () => void;

   constructor(position: Point, type: ProjectileType, lifetime: number, data: number) {
      super(position);

      this.type = type;
      this.lifetime = lifetime;

      // By default, projectiles aren't affected by friction
      this.isAffectedByFriction = false;

      this.data = data;
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
}

export default Projectile;