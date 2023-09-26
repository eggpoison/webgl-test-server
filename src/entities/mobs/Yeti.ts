import { GameObjectDebugData, ItemType, PlayerCauseOfDeath, Point, randFloat, randInt, randItem, SETTINGS, SnowballSize, TileType, Vector, veryBadHash } from "webgl-test-shared";
import HealthComponent from "../../entity-components/HealthComponent";
import ItemCreationComponent from "../../entity-components/ItemCreationComponent";
import Mob from "./Mob";
import Entity from "../Entity";
import CircularHitbox from "../../hitboxes/CircularHitbox";
import _GameObject from "../../GameObject";
import Tile from "../../tiles/Tile";
import WanderAI from "../../mob-ai/WanderAI";
import ChaseAI from "../../mob-ai/ChaseAI";
import ItemConsumeAI from "../../mob-ai/ItemConsumeAI";
import Board from "../../Board";
import Snowball from "../Snowball";

enum SnowThrowStage {
   windup,
   hold,
   return
}

/** Stores which tiles belong to which yetis' territories */
const yetiTerritoryTiles: Record<number, Yeti> = {};

const tileBelongsToYetiTerritory = (tileX: number, tileY: number): boolean => {
   const tileIndex = tileY * SETTINGS.BOARD_DIMENSIONS + tileX;
   return yetiTerritoryTiles.hasOwnProperty(tileIndex);
}

const registerYetiTerritory = (territory: ReadonlyArray<Tile>, yeti: Yeti): void => {
   for (const tile of territory) {
      const tileIndex = tile.y * SETTINGS.BOARD_DIMENSIONS + tile.x;
      yetiTerritoryTiles[tileIndex] = yeti;
   }
}

const removeYetiTerritory = (tileX: number, tileY: number): void => {
   const tileIndex = tileY * SETTINGS.BOARD_DIMENSIONS + tileX;
   delete yetiTerritoryTiles[tileIndex];
}

class Yeti extends Mob {
   private static readonly MAX_HEALTH = 100;

   private static readonly SIZE = 128;

   private static readonly CONTACT_DAMAGE = 3;
   private static readonly CONTACT_KNOCKBACK = 200;

   private static readonly YETI_TILES: ReadonlySet<TileType> = new Set(["snow", "ice", "permafrost"]);
   
   /** Minimum number of tiles that can belong to a yeti */
   private static readonly MIN_TERRITORY_SIZE = 50;
   private static readonly MAX_TERRITORY_SIZE = 100;

   private static readonly VISION_RANGE = SETTINGS.TILE_SIZE * 7;

   private static readonly ATTACK_PURSUE_TIME = 5;

   private static readonly SNOW_THROW_COOLDOWN = 7;
   private static readonly SMALL_SNOWBALL_THROW_SPEED = [550, 650] as const;
   private static readonly LARGE_SNOWBALL_THROW_SPEED = [350, 450] as const;
   private static readonly SNOW_THROW_ARC = Math.PI/5;
   private static readonly SNOW_THROW_OFFSET = 64;
   private static readonly SNOW_THROW_WINDUP_TIME = 1.75;
   private static readonly SNOW_THROW_HOLD_TIME = 0.1;
   private static readonly SNOW_THROW_RETURN_TIME = 0.6;
   private static readonly SNOW_THROW_KICKBACK_AMOUNT = 110;

   public readonly mass = 3;
   
   private readonly territory: ReadonlyArray<Tile>;

   // Stores the ids of all entities which have recently attacked the yeti
   private readonly attackingEntities: Record<number, number> = {};

   private attackTarget: Entity | null = null;
   private isThrowingSnow = false;
   private snowThrowStage: SnowThrowStage = SnowThrowStage.windup;
   private snowThrowAttackProgress = 1;
   private snowThrowCooldown = Yeti.SNOW_THROW_COOLDOWN;
   private snowThrowHoldTimer = 0;

   /** Stores the ID's of all snowballs thrown by the yeti */
   private readonly snowballIDs = new Set<number>();

   constructor(position: Point) {
      super(position, {
         health: new HealthComponent(Yeti.MAX_HEALTH, false),
         item_creation: new ItemCreationComponent()
      }, "yeti", Yeti.VISION_RANGE, true);

      this.setAIParam("hunger", randInt(0, 50));
      this.setAIParam("metabolism", 1);

      const hitbox = new CircularHitbox();
      hitbox.setHitboxInfo(Yeti.SIZE / 2);
      this.addHitbox(hitbox);

      // Snow throw AI
      this.addAI(new ChaseAI(this, {
         aiWeightMultiplier: 1.5,
         acceleration: 0,
         terminalVelocity: 0,
         entityIsChased: (entity: Entity) => {
            return entity === this.attackTarget;
         }
      }));

      // Regular chase AI
      this.addAI(new ChaseAI(this, {
         aiWeightMultiplier: 1,
         acceleration: 200,
         terminalVelocity: 100,
         entityIsChased: (entity: Entity) => {
            // Don't chase ice spikes or snowballs
            if (entity.type === "ice_spikes" || entity.type === "snowball") {
               return false;
            }
            
            // Chase the entity if they are in the yeti's territory or have recently attacked the yeti
            return this.territory.includes(entity.tile) || this.attackingEntities.hasOwnProperty(entity.id);
         },
         callback: (targetEntity: Entity | null) => {
            if (targetEntity === null) {
               return;
            }

            if (this.shouldThrowSnow()) {
               this.isThrowingSnow = true;
               this.attackTarget = targetEntity;
               this.snowThrowAttackProgress = 1;
               this.snowThrowStage = SnowThrowStage.windup;
            }
         }
      }));

      this.addAI(new ItemConsumeAI(this, {
         aiWeightMultiplier: 0.8,
         acceleration: 100,
         terminalVelocity: 50,
         metabolism: 1,
         itemTargets: new Set([ItemType.raw_beef, ItemType.leather])
      }));

      this.addAI(new WanderAI(this, {
         aiWeightMultiplier: 0.5,
         wanderRate: 0.6,
         acceleration: 100,
         terminalVelocity: 50,
         validTileTargets: Yeti.YETI_TILES,
         shouldWander: (position: Point): boolean => {
            const tileX = Math.floor(position.x / SETTINGS.TILE_SIZE);
            const tileY = Math.floor(position.y / SETTINGS.TILE_SIZE);
            const tile = Board.getTile(tileX, tileY);
            return this.territory.includes(tile);
         }
      }));

      this.createEvent("hurt", (_, attackingEntity: Entity | null) => {
         if (attackingEntity !== null) {
            this.attackingEntities[attackingEntity.id] = Yeti.ATTACK_PURSUE_TIME;
         }
      });

      this.createEvent("during_entity_collision", (collidingEntity: Entity): void => {
         // Don't damage ice spikes
         if (collidingEntity.type === "ice_spikes") return;

         // Don't damage snowballs thrown by the yeti
         if (collidingEntity.type === "snowball" && this.snowballIDs.has(collidingEntity.id)) {
            return;
         }
         
         const healthComponent = collidingEntity.getComponent("health");
         if (healthComponent !== null) {
            const hitDirection = this.position.calculateAngleBetween(collidingEntity.position);
            healthComponent.damage(Yeti.CONTACT_DAMAGE, Yeti.CONTACT_KNOCKBACK, hitDirection, this, PlayerCauseOfDeath.yeti, 0, "yeti");
            healthComponent.addLocalInvulnerabilityHash("yeti", 0.3);
         }
      });

      this.rotation = 2 * Math.PI * Math.random();

      this.getComponent("item_creation")!.createItemOnDeath(ItemType.raw_beef, randInt(4, 7), false);
      this.getComponent("item_creation")!.createItemOnDeath(ItemType.yeti_hide, randInt(2, 3), true);

      this.territory = Yeti.generateYetiTerritoryTiles(this.tile.x, this.tile.y);
      registerYetiTerritory(this.territory, this);

      this.createEvent("death", () => {
         for (const tile of this.territory) {
            removeYetiTerritory(tile.x, tile.y);
         }
      });
   }

   public tick(): void {
      super.tick();

      for (const id of Object.keys(this.attackingEntities) as unknown as ReadonlyArray<number>) {
         this.attackingEntities[id] -= 1 / SETTINGS.TPS;
         if (this.attackingEntities[id] <= 0) {
            delete this.attackingEntities[id];
         }
      }

      if (this.isThrowingSnow) {
         // If the target has run outside the yeti's vision range, cancel the attack
         if (this.attackTarget !== null && this.position.calculateDistanceBetween(this.attackTarget.position) > Yeti.VISION_RANGE) {
            this.snowThrowAttackProgress = 1;
            this.attackTarget = null;
            this.isThrowingSnow = false;
         } else {
            switch (this.snowThrowStage) {
               case SnowThrowStage.windup: {
                  this.snowThrowAttackProgress -= 1 / SETTINGS.TPS / Yeti.SNOW_THROW_WINDUP_TIME;
                  if (this.snowThrowAttackProgress <= 0) {
                     this.throwSnow(this.attackTarget!);
                     this.snowThrowAttackProgress = 0;
                     this.snowThrowCooldown = Yeti.SNOW_THROW_COOLDOWN;
                     this.snowThrowStage = SnowThrowStage.hold;
                     this.snowThrowHoldTimer = 0;
                  }
                  break;
               }
               case SnowThrowStage.hold: {
                  this.snowThrowHoldTimer += 1 / SETTINGS.TPS;
                  if (this.snowThrowHoldTimer >= Yeti.SNOW_THROW_HOLD_TIME) {
                     this.snowThrowStage = SnowThrowStage.return;
                  }
                  break;
               }
               case SnowThrowStage.return: {
                  this.snowThrowAttackProgress += 1 / SETTINGS.TPS / Yeti.SNOW_THROW_RETURN_TIME;
                  if (this.snowThrowAttackProgress >= 1) {
                     this.snowThrowAttackProgress = 1;
                     this.attackTarget = null;
                     this.isThrowingSnow = false;
                  }
               }
            }
         }
      }

      this.snowThrowCooldown -= 1 / SETTINGS.TPS;
      if (this.snowThrowCooldown < 0) {
         this.snowThrowCooldown = 0;
      }
   }

   private shouldThrowSnow(): boolean {
      return this.snowThrowCooldown === 0 && !this.isThrowingSnow;
   }

   private throwSnow(target: Entity): void {
      const throwAngle = this.position.calculateAngleBetween(target.position);

      // Large snowballs
      for (let i = 0; i < 2; i++) {
         this.createSnowball(SnowballSize.large, throwAngle);
      }

      // Small snowballs
      for (let i = 0; i < 3; i++) {
         this.createSnowball(SnowballSize.small, throwAngle);
      }

      // Kickback
      this.addVelocity(new Vector(Yeti.SNOW_THROW_KICKBACK_AMOUNT, throwAngle + Math.PI));
   }

   private createSnowball(size: SnowballSize, throwAngle: number): void {
      const angle = throwAngle + randFloat(-Yeti.SNOW_THROW_ARC, Yeti.SNOW_THROW_ARC);
      
      const position = this.position.copy();
      const offset = new Vector(Yeti.SNOW_THROW_OFFSET, angle).convertToPoint();
      position.add(offset);

      let velocityMagnitude: number;
      if (size === SnowballSize.small) {
         velocityMagnitude = randFloat(...Yeti.SMALL_SNOWBALL_THROW_SPEED);
      } else {
         velocityMagnitude = randFloat(...Yeti.LARGE_SNOWBALL_THROW_SPEED);
      }
      const velocity = new Vector(velocityMagnitude, angle);

      const snowball = new Snowball(position, false, size);
      snowball.velocity = velocity;

      // Keep track of the snowball
      this.snowballIDs.add(snowball.id);
      snowball.createEvent("death", () => {
         this.snowballIDs.delete(snowball.id);
      });

      snowball.createEvent("during_entity_collision", (collidingEntity: Entity) => {
         // Don't let the yeti damage itself or other snowballs
         if (collidingEntity === this || collidingEntity.type === "snowball") {
            return;
         }
         
         if (!snowball.canDamage) {
            return;
         }

         const healthComponent = collidingEntity.getComponent("health");
         if (healthComponent !== null) {
            const hitDirection = snowball.position.calculateAngleBetween(collidingEntity.position);
            healthComponent.damage(4, 100, hitDirection, null, PlayerCauseOfDeath.snowball, 0);
            healthComponent.addLocalInvulnerabilityHash("snowball", 0.3);
         }
      });
   }

   public getClientArgs(): [attackProgress: number] {
      return [this.snowThrowAttackProgress];
   }

   public getDebugData(): GameObjectDebugData {
      const debugData = super.getDebugData();

      const hash = veryBadHash(this.id.toString());
      
      // Generate rgb based on second, third and fourth digits of the hash
      const r = (Math.floor(hash / 10) % 10) / 10;
      const g = (Math.floor(hash / 10) % 100) / 100;
      const b = (Math.floor(hash / 10) % 1000) / 1000 * 0.5; // Generate less blue so the colour doesnt blend in with the tundra
      
      for (const tile of this.territory) {
         debugData.tileHighlights.push(
            {
               tilePosition: [tile.x, tile.y],
               colour: [r, g, b]
            }
         );
      }
      
      return debugData;
   }

   private static generateYetiTerritoryTiles(originTileX: number, originTileY: number): ReadonlyArray<Tile> {
      // const checkedTiles = new Array<Tile>();
      const territoryTiles = new Array<Tile>();
      // Tiles to expand the territory from
      const spreadTiles = new Array<Tile>();

      const tileIsValid = (tile: Tile): boolean => {
         // Make sure the tile is inside the board
         if (tile.x < 0 || tile.x >= SETTINGS.BOARD_DIMENSIONS || tile.y < 0 || tile.y >= SETTINGS.BOARD_DIMENSIONS) {
            return false;
         }

         return tile.biomeName === "tundra" && !tileBelongsToYetiTerritory(tile.x, tile.y) && !territoryTiles.includes(tile);
      }

      const originTile = Board.getTile(originTileX, originTileY);
      territoryTiles.push(originTile);
      spreadTiles.push(originTile);
   
      while (spreadTiles.length > 0) {
         // Pick a random tile to expand from
         const idx = Math.floor(Math.random() * spreadTiles.length);
         const tile = spreadTiles[idx];

         const potentialTiles = [
            [tile.x + 1, tile.y],
            [tile.x - 1, tile.y],
            [tile.x, tile.y + 1],
            [tile.x, tile.y - 1]
         ];

         // Remove out of bounds tiles
         for (let i = 3; i >= 0; i--) {
            const tileCoordinates = potentialTiles[i];
            if (!Board.tileIsInBoard(tileCoordinates[0], tileCoordinates[1])) {
               potentialTiles.splice(i, 1);
            }
         }

         let numValidTiles = 0;

         for (let i = potentialTiles.length - 1; i >= 0; i--) {
            const tileCoordinates = potentialTiles[i];
            const tile = Board.getTile(tileCoordinates[0], tileCoordinates[1]);
            if (tileIsValid(tile)) {
               numValidTiles++;
            } else {
               potentialTiles.splice(i, 1);
            }
         }

         if (numValidTiles === 0) {
            spreadTiles.splice(idx, 1);
         } else {
            // Pick a random tile to expand to
            const [tileX, tileY] = randItem(potentialTiles);
            const tile = Board.getTile(tileX, tileY);
            territoryTiles.push(tile);
            spreadTiles.push(tile);
         }
   
         if (territoryTiles.length >= Yeti.MAX_TERRITORY_SIZE) {
            break;
         }
      }
   
      return territoryTiles;
   }

   public static spawnValidationFunction(position: Point): boolean {
      const originTileX = Math.floor(position.x / SETTINGS.TILE_SIZE);
      const originTileY = Math.floor(position.y / SETTINGS.TILE_SIZE);

      const territoryTiles = Yeti.generateYetiTerritoryTiles(originTileX, originTileY);
      return territoryTiles.length >= Yeti.MIN_TERRITORY_SIZE;
   }
}

export default Yeti;