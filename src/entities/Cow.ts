import { CowSpecies, EntityType, ENTITY_INFO_RECORD, Point } from "webgl-test-shared";
import HerdPassiveMobAI from "../ai/HerdPassiveMobAI";
import PassiveMobAI from "../ai/PassiveMobAI";
import HealthComponent from "../entity-components/HealthComponent";
import ItemCreationComponent from "../entity-components/ItemCreationComponent";
import Entity from "./Entity";
import Mob from "./Mob";

class Cow extends Mob {
   private static readonly MAX_HEALTH = 10;

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

   constructor(position: Point, species: CowSpecies) {
      const itemCreationComponent = new ItemCreationComponent();

      super("cow", position, null, null, 2 * Math.PI * Math.random(), [
         new HealthComponent(Cow.MAX_HEALTH, Cow.MAX_HEALTH, 0),
         itemCreationComponent
      ]);

      this.species = species;

      this.ai = new HerdPassiveMobAI(this, {
         wanderChance: Cow.WANDER_CHANCE,
         wanderAcceleration: Cow.WANDER_ACCELERATION,
         wanderTerminalVelocity: Cow.WANDER_TERMINAL_VELOCITY,
         visionRange: Cow.VISION_RANGE,
         escapeRange: Cow.ESCAPE_RANGE,
         stareLockTime: Cow.STARE_LOCK_TIME,
         stareTime: Cow.STARE_TIME,
         stareCooldown: Cow.STARE_COOLDOWN,
         grazingBehaviour: {
            targetTileType: "grass",
            grazingTime: 3,
            digestionTime: 1,
            cooldown: 10
         },
         minHerdMemberDistance: Cow.MIN_HERD_MEMBER_DISTANCE,
         turnSpeed: Cow.TURN_SPEED,
         herdValidationFunction: (entity: Entity) => this.herdValidationFunction(entity)
      });

      itemCreationComponent.createItemOnDeath("raw_beef", 3);
   }

   public getClientArgs(): [species: CowSpecies] {
      return [this.species];
   }

   private herdValidationFunction(entity: Entity): boolean {
      return entity instanceof Cow && entity.species === this.species;
   }
}

export default Cow;