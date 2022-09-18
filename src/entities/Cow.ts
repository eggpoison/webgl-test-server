import { CowSpecies, EntityType, ENTITY_INFO_RECORD, Point } from "webgl-test-shared";
import HerdPassiveMobAI from "../ai/HerdPassiveMobAI";
import PassiveMobAI from "../ai/PassiveMobAI";
import HealthComponent from "../entity-components/HealthComponent";
import Entity from "./Entity";
import Mob from "./Mob";

class Cow extends Mob<"cow"> {
   private static readonly MAX_HEALTH = 10;

   public readonly type = "cow";

   private static readonly WANDER_CHANCE = 0.6;
   private static readonly WANDER_ACCELERATION = 100;
   private static readonly WANDER_TERMINAL_VELOCITY = 50;
   private static readonly VISION_RANGE = 300;
   private static readonly ESCAPE_RANGE = 300;
   private static readonly STARE_LOCK_TIME = 3;
   private static readonly STARE_TIME = 7;
   private static readonly STARE_COOLDOWN = 10;
   private static readonly MIN_HERD_MEMBER_DISTANCE = 120;
   private static readonly TURN_SPEED = 0.2;
   protected readonly ai: PassiveMobAI;

   public readonly species: CowSpecies;

   public readonly hitbox = ENTITY_INFO_RECORD.cow.hitbox;

   constructor(position: Point, species: CowSpecies) {
      super(position, null, null, 2 * Math.PI * Math.random(), [
         new HealthComponent(Cow.MAX_HEALTH, Cow.MAX_HEALTH, 0)
      ]);

      this.species = species;

      // this.ai = new PassiveMobAI(this, {
      //    wanderChance: Cow.WANDER_CHANCE,
      //    wanderAcceleration: Cow.WANDER_ACCELERATION,
      //    wanderTerminalVelocity: Cow.WANDER_TERMINAL_VELOCITY,
      //    visionRange: Cow.VISION_RANGE,
      //    escapeRange: Cow.ESCAPE_RANGE,
      //    stareLockTime: Cow.STARE_LOCK_TIME,
      //    stareTime: Cow.STARE_TIME,
      //    stareCooldown: Cow.STARE_COOLDOWN
      // });
      this.ai = new HerdPassiveMobAI(this, {
         wanderChance: Cow.WANDER_CHANCE,
         wanderAcceleration: Cow.WANDER_ACCELERATION,
         wanderTerminalVelocity: Cow.WANDER_TERMINAL_VELOCITY,
         visionRange: Cow.VISION_RANGE,
         escapeRange: Cow.ESCAPE_RANGE,
         stareLockTime: Cow.STARE_LOCK_TIME,
         stareTime: Cow.STARE_TIME,
         stareCooldown: Cow.STARE_COOLDOWN,
         minHerdMemberDistance: Cow.MIN_HERD_MEMBER_DISTANCE,
         turnSpeed: Cow.TURN_SPEED,
         herdValidationFunction: (entity: Entity<EntityType>) => this.herdValidationFunction(entity)
      });
   }

   public getClientArgs(): [species: CowSpecies] {
      return [this.species];
   }

   private herdValidationFunction(entity: Entity<EntityType>): boolean {
      return entity instanceof Cow && entity.species === this.species;
   }
}

export default Cow;