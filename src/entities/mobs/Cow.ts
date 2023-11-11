import { COLLISION_BITS, CowSpecies, DEFAULT_COLLISION_MASK, ItemType, Point, randFloat, randInt, RESOURCE_ENTITY_TYPES, SETTINGS, TileType, TileTypeConst } from "webgl-test-shared";
import HealthComponent from "../../entity-components/HealthComponent";
import ItemCreationComponent from "../../entity-components/ItemCreationComponent";
import HungerComponent from "../../entity-components/HungerComponent";
import RectangularHitbox from "../../hitboxes/RectangularHitbox";
import Mob from "./Mob";
import EscapeAI from "../../mob-ai/EscapeAI";
import ItemConsumeAI from "../../mob-ai/ItemConsumeAI";
import TileConsumeAI from "../../mob-ai/TileConsumeAI";
import HerdAI from "../../mob-ai/HerdAI";
import FollowAI from "../../mob-ai/FollowAI";
import WanderAI from "../../mob-ai/WanderAI";
import BerryBushShakeAI from "../../mob-ai/BerryBushShakeAI";
import { MobAIType } from "../../mob-ai-types";

class Cow extends Mob {
   private static readonly MAX_HEALTH = 10;

   public mass = 1.2;

   public species: CowSpecies;

   public readonly collisionBit = COLLISION_BITS.other;
   public readonly collisionMask = DEFAULT_COLLISION_MASK;

   constructor(position: Point) {
      super(position, {
         health: new HealthComponent(Cow.MAX_HEALTH, false),
         item_creation: new ItemCreationComponent(48),
         hunger: new HungerComponent(randFloat(0, 25), randFloat(2.5, 3))
      }, "cow", SETTINGS.TILE_SIZE * 4);

      this.species = Math.random() < 0.5 ? CowSpecies.brown : CowSpecies.black;
      this.herdMemberHash = this.species;

      this.addAI(new EscapeAI(this, {
         acceleration: 200,
         terminalVelocity: 200,
         attackSubsideTime: 5,
         escapeHealthThreshold: Cow.MAX_HEALTH
      }));

      this.addAI(new TileConsumeAI(this, {
         acceleration: 100,
         terminalVelocity: 50,
         tileTargets: new Map([
            [TileTypeConst.grass, {
               resultingTileType: TileTypeConst.dirt,
               foodUnits: 100,
               grazeTime: 5,
               healAmount: 3
            }]
         ])
      }));

      this.addAI(new ItemConsumeAI(this, {
         acceleration: 100,
         terminalVelocity: 50,
         itemTargets: new Set([ItemType.berry])
      }));

      this.addAI(new BerryBushShakeAI(this));

      const herdAI = new HerdAI(this, {
         acceleration: 100,
         terminalVelocity: 50,
         minSeperationDistance: 150,
         turnRate: 0.2,
         minActivateAmount: 3,
         maxActivateAmount: 6,
         validHerdMembers: new Set(["cow"]),
         seperationInfluence: 0.7,
         alignmentInfluence: 0.5,
         cohesionInfluence: 0.3
      });
      this.addAI(herdAI);

      this.addAI(new FollowAI(this, {
         acceleration: 50,
         terminalVelocity: 25,
         minDistanceFromFollowTarget: 100,
         weightBuildupTime: randFloat(15, 20),
         interestDuration: 7,
         chanceToGainInterest: 0.2,
         followableEntityTypes: new Set(["player", "tribesman", "zombie"])
      }));

      this.addAI(new WanderAI(this, {
         wanderRate: 0.6,
         acceleration: 100,
         terminalVelocity: 50,
         strictValidation: false,
         tileValidationPadding: 0
      }));

      const hitbox = new RectangularHitbox(50, 100, 0, 0);
      this.addHitbox(hitbox);

      this.rotation = 2 * Math.PI * Math.random();

      this.species = Math.random() < 0.5 ? CowSpecies.brown : CowSpecies.black;

      this.forceGetComponent("item_creation").createItemOnDeath(ItemType.raw_beef, randInt(1, 2), false);
      this.forceGetComponent("item_creation").createItemOnDeath(ItemType.leather, randInt(0, 2), true);
   }

   public getClientArgs(): [species: CowSpecies, grazeProgress: number] {
      let grazeProgress;
      if (this.currentAI !== null && this.currentAI.type === MobAIType.tileConsume) {
         grazeProgress = (this.currentAI as TileConsumeAI).getGrazeProgress();
      } else {
         grazeProgress = -1;
      }

      return [this.species, grazeProgress];
   }
}

export default Cow;