import { CowSpecies, ItemType, Point, randInt, SETTINGS, TileType } from "webgl-test-shared";
import HealthComponent from "../../entity-components/HealthComponent";
import ItemCreationComponent from "../../entity-components/ItemCreationComponent";
import RectangularHitbox from "../../hitboxes/RectangularHitbox";
import Mob from "./Mob";
import EscapeAI from "../../mob-ai/EscapeAI";
import ItemConsumeAI from "../../mob-ai/ItemConsumeAI";
import TileConsumeAI from "../../mob-ai/TileConsumeAI";
import HerdAI from "../../mob-ai/HerdAI";
import FollowAI from "../../mob-ai/FollowAI";
import WanderAI from "../../mob-ai/WanderAI";
import BerryBushShakeAI from "../../mob-ai/BerryBushShakeAI";

class Cow extends Mob {
   private static readonly MAX_HEALTH = 10;

   public mass = 1.5;

   public species: CowSpecies;

   constructor(position: Point) {
      super(position, {
         health: new HealthComponent(Cow.MAX_HEALTH, false),
         item_creation: new ItemCreationComponent(48)
      }, "cow", SETTINGS.TILE_SIZE * 4);

      this.species = Math.random() < 0.5 ? CowSpecies.brown : CowSpecies.black;

      this.setAIParam("hunger", randInt(0, 50));
      this.setAIParam("metabolism", 2.5);

      this.addAI(new WanderAI(this, {
         aiWeightMultiplier: 0.5,
         wanderRate: 0.6,
         acceleration: 100,
         terminalVelocity: 50
      }));

      this.addAI(new FollowAI(this, {
         aiWeightMultiplier: 0.75,
         acceleration: 50,
         terminalVelocity: 25,
         minDistanceFromFollowTarget: 100,
         weightBuildupTime: 10,
         interestDuration: 7,
         chanceToGainInterest: 0.2,
         followableEntityTypes: new Set(["player", "tribesman", "zombie"])
      }));

      const herdAI = new HerdAI(this, {
         aiWeightMultiplier: 1,
         acceleration: 100,
         terminalVelocity: 50,
         minSeperationDistance: 150,
         turnRate: 0.2,
         maxWeightInflenceCount: 3,
         weightInfluenceFalloff: {
            start: 5,
            duration: 2
         },
         validHerdMembers: new Set(["cow"]),
         seperationInfluence: 0.7,
         alignmentInfluence: 0.5,
         cohesionInfluence: 0.3
      });
      herdAI.herdMemberHash = this.species;
      this.addAI(herdAI);

      this.addAI(new TileConsumeAI(this, {
         aiWeightMultiplier: 1.25,
         acceleration: 100,
         terminalVelocity: 50,
         tileTargets: new Map([
            [TileType.grass, {
               resultingTileType: TileType.dirt,
               foodUnits: 100,
               grazeTime: 5,
               healAmount: 3
            }]
         ])
      }));

      this.addAI(new ItemConsumeAI(this, {
         aiWeightMultiplier: 1.25,
         acceleration: 100,
         terminalVelocity: 50,
         metabolism: 20,
         itemTargets: new Set([ItemType.berry])
      }));

      this.addAI(new BerryBushShakeAI(this, {
         aiWeightMultiplier: 1.1
      }));

      this.addAI(new EscapeAI(this, {
         aiWeightMultiplier: 1.5,
         acceleration: 200,
         terminalVelocity: 200,
         attackSubsideTime: 5,
         escapeHealthThreshold: Cow.MAX_HEALTH
      }));

      const hitbox = new RectangularHitbox();
      hitbox.setHitboxInfo(50, 100);
      this.addHitbox(hitbox);

      this.rotation = 2 * Math.PI * Math.random();

      this.species = Math.random() < 0.5 ? CowSpecies.brown : CowSpecies.black;

      this.getComponent("item_creation")!.createItemOnDeath(ItemType.raw_beef, randInt(1, 2), false);
      this.getComponent("item_creation")!.createItemOnDeath(ItemType.leather, randInt(0, 2), true);
   }

   public getClientArgs(): [species: CowSpecies, grazeProgress: number] {
      const currentAI = this.getCurrentAI();
      
      let grazeProgress;
      if (currentAI !== null && currentAI.type === "tileConsume") {
         grazeProgress = (currentAI as TileConsumeAI).getGrazeProgress();
      } else {
         grazeProgress = -1;
      }

      return [this.species, grazeProgress];
   }
}

export default Cow;