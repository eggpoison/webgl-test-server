import { CraftingRecipe, HitboxVertexPositions, IEntityType, ItemType, PlaceableItemType, Point, PotentialBuildingPlanData, SettingsConst, TECHS, TRIBE_INFO_RECORD, TechID, TechTreeUnlockProgress, TribeType, clampToBoardDimensions, getTechByID } from "webgl-test-shared";
import Board from "./Board";
import Tile from "./Tile";
import Chunk from "./Chunk";
import Entity from "./Entity";
import { HutComponentArray, InventoryComponentArray, TotemBannerComponentArray } from "./components/ComponentArray";
import { createTribeWorker } from "./entities/tribes/tribe-worker";
import { TotemBannerComponent, addBannerToTotem, removeBannerFromTotem } from "./components/TotemBannerComponent";
import { createTribeWarrior } from "./entities/tribes/tribe-warrior";
import { SERVER } from "./server";
import { VulnerabilityNode, VulnerabilityNodeIndex } from "./ai-tribe-building";
import { getInventory } from "./components/InventoryComponent";

const RESPAWN_TIME_TICKS = 5 * SettingsConst.TPS;

let idCounter = 0;

const getAvailableID = (): number => {
   return idCounter++;
}

const TRIBE_BUILDING_AREA_INFLUENCES = {
   [IEntityType.tribeTotem]: 200,
   [IEntityType.workerHut]: 150,
   [IEntityType.warriorHut]: 150
} satisfies Partial<Record<IEntityType, number>>;

interface TileInfluence {
   readonly tile: Tile;
   /** The number of buildings contributing to the tile */
   numInfluences: number;
}

interface ChunkInfluence {
   readonly chunk: Chunk;
   numInfluences: number;
}

export interface BuildingPlan {
   readonly position: Point;
   readonly rotation: number;
   readonly buildingRecipe: CraftingRecipe;
   assignedTribesmanID: number;
}

export interface RestrictedBuildingArea {
   readonly x: number;
   readonly y: number;
   readonly width: number;
   readonly height: number;
   readonly rotation: number;
   /** The ID of the building responsible for the restricted area */
   readonly associatedBuildingID: number;
   readonly vertexOffsets: HitboxVertexPositions;
}

class Tribe {
   public readonly id: number;
   
   public readonly type: TribeType;
   public readonly isAIControlled: boolean;

   public totem: Entity | null = null;
   
   // /** Stores all tribe huts belonging to the tribe */
   private readonly huts = new Array<Entity>();

   public barrels = new Array<Entity>();

   public readonly researchBenches = new Array<Entity>();

   public readonly buildings = new Array<Entity>();
   public buildingsAreDirty = true;

   public buildingPlan: BuildingPlan | null = null;

   /** Stores all tiles in the tribe's zone of influence */
   private area: Record<number, TileInfluence> = {};
   private chunkArea: Record<number, ChunkInfluence> = {};

   public tribesmanCap: number;

   public selectedTechID: TechID | null = null;
   public readonly unlockedTechs = new Array<TechID>();
   public readonly techTreeUnlockProgress: TechTreeUnlockProgress = {};

   private readonly respawnTimesRemaining = new Array<number>();
   private readonly respawnHutIDs = new Array<number>();

   /** IDs of all friendly tribesmen */
   public readonly friendlyTribesmenIDs = new Array<number>();

   public vulnerabilityNodes = new Array<VulnerabilityNode>();
   public vulnerabilityNodeRecord: Record<number, VulnerabilityNode> = {};
   public occupiedVulnerabilityNodes = new Set<VulnerabilityNodeIndex>();
   public insideNodes = new Set<number>();
   public containedBuildingIDs = new Set<number>();
   public occupiedNodeToEntityIDRecord: Record<VulnerabilityNodeIndex, number> = {};

   public restrictedBuildingAreas = new Array<RestrictedBuildingArea>();

   public potentialPlansData: ReadonlyArray<PotentialBuildingPlanData> = [];

   public availableResources: Partial<Record<ItemType, number>> = {};
   
   constructor(tribeType: TribeType, isAIControlled: boolean) {
      this.id = getAvailableID();
      this.type = tribeType;
      this.isAIControlled = isAIControlled;

      this.tribesmanCap = TRIBE_INFO_RECORD[tribeType].baseTribesmanCap;

      Board.addTribe(this);
   }

   public addBuilding(building: Entity): void {
      this.buildings.push(building);
      this.buildingsAreDirty = true;
   }

   public removeBuilding(building: Entity): void {
      this.buildings.splice(this.buildings.indexOf(building), 1);
      this.buildingsAreDirty = true;
   }

   public setTotem(totem: Entity): void {
      if (this.totem !== null) {
         console.warn("Tribe already has a totem.");
         return;
      }

      this.totem = totem;
      this.addBuilding(totem);

      this.createTribeAreaAroundBuilding(totem.position, TRIBE_BUILDING_AREA_INFLUENCES[IEntityType.tribeTotem]);
   }

   public clearTotem(): void {
      if (this.totem === null) {
         return;
      }

      this.removeBuilding(this.totem);
      this.totem = null;

      // @Incomplete
   }

   public unlockTech(techID: TechID): void {
      if (!this.unlockedTechs.includes(techID)) {
         this.unlockedTechs.push(techID);
         this.selectedTechID = null;
      }
   }

   public tick(): void {
      // Destroy tribe if it has no entities left
      if (this.totem === null && this.barrels.length === 0 && this.friendlyTribesmenIDs.length === 0 && this.huts.length === 0 && this.researchBenches.length === 0) {
         this.destroy();
         return;
      }

      for (let i = 0; i < this.respawnTimesRemaining.length; i++) {
         if (--this.respawnTimesRemaining[i] <= 0) {
            const hutID = this.respawnHutIDs[i];
            if (Board.entityRecord.hasOwnProperty(hutID)) {
               const hut = Board.entityRecord[hutID];
               this.createNewTribesman(hut);
            }
            
            this.respawnTimesRemaining.splice(i, 1);
            this.respawnHutIDs.splice(i, 1);
            i--;
         }
      }
   }

   public addResearchBench(bench: Entity): void {
      this.researchBenches.push(bench);
      this.buildings.push(bench);
      this.buildingsAreDirty = true;
   }

   public removeResearchBench(bench: Entity): void {
      const idx = this.researchBenches.indexOf(bench);
      if (idx !== -1) {
         this.researchBenches.splice(idx, 1);
      }
      this.removeBuilding(bench);
   }
   
   // @Cleanup: Call these functions from the hut create functions
   public registerNewWorkerHut(workerHut: Entity): void {
      if (this.totem === null) {
         console.warn("Can't register a hut without a totem!");
         return;
      }

      this.huts.push(workerHut);
      this.addBuilding(workerHut);

      // Create a tribesman for the hut, but 1 tick after as to not cause a crash in the join buffer
      this.respawnTimesRemaining.push(1);
      this.respawnHutIDs.push(workerHut.id);

      this.createTribeAreaAroundBuilding(workerHut.position, TRIBE_BUILDING_AREA_INFLUENCES[IEntityType.workerHut]);
      
      // @Hack
      let bannerComponent: TotemBannerComponent;
      if (TotemBannerComponentArray.hasComponent(this.totem)) {
         bannerComponent = TotemBannerComponentArray.getComponent(this.totem.id);
      } else {
         bannerComponent = TotemBannerComponentArray.getComponentFromBuffer(this.totem);
      }

      addBannerToTotem(bannerComponent, this.huts.length - 1);
   }

   public registerNewWarriorHut(warriorHut: Entity): void {
      if (this.totem === null) {
         console.warn("Can't register hut without a tribe.");
         return;
      }

      this.huts.push(warriorHut);
      this.addBuilding(warriorHut);

      // Create a tribesman for the hut, but 1 tick after as to not cause a crash in the join buffer
      this.respawnTimesRemaining.push(1);
      this.respawnHutIDs.push(warriorHut.id);

      this.createTribeAreaAroundBuilding(warriorHut.position, TRIBE_BUILDING_AREA_INFLUENCES[IEntityType.warriorHut]);
      
      // @Hack
      let bannerComponent: TotemBannerComponent;
      if (TotemBannerComponentArray.hasComponent(this.totem)) {
         bannerComponent = TotemBannerComponentArray.getComponent(this.totem.id);
      } else {
         bannerComponent = TotemBannerComponentArray.getComponentFromBuffer(this.totem);
      }

      addBannerToTotem(bannerComponent, this.huts.length - 1);
   }

   public removeWorkerHut(hut: Entity): void {
      const idx = this.huts.indexOf(hut);
      if (idx !== -1) {
         this.huts.splice(idx, 1);
      }
      this.removeBuilding(hut);

      if (this.totem !== null) {
         const bannerComponent = TotemBannerComponentArray.getComponent(this.totem.id);
         removeBannerFromTotem(bannerComponent, idx);
      }

      this.removeBuildingFromTiles(hut.position, TRIBE_BUILDING_AREA_INFLUENCES[IEntityType.workerHut]);
   }

   public removeWarriorHut(hut: Entity): void {
      const idx = this.huts.indexOf(hut);
      if (idx !== -1) {
         this.huts.splice(idx, 1);
      }
      this.removeBuilding(hut);

      if (this.totem !== null) {
         const bannerComponent = TotemBannerComponentArray.getComponent(this.totem.id);
         removeBannerFromTotem(bannerComponent, idx);
      }

      this.removeBuildingFromTiles(hut.position, TRIBE_BUILDING_AREA_INFLUENCES[IEntityType.warriorHut]);
   }

   public hasHut(hut: Entity): boolean {
      return this.huts.includes(hut);
   }

   public hasTotem(totem: Entity): boolean {
      return this.totem === totem;
   }

   public respawnTribesman(hut: Entity): void {
      this.respawnTimesRemaining.push(RESPAWN_TIME_TICKS);
      this.respawnHutIDs.push(hut.id);
   }

   public createNewTribesman(hut: Entity): void {
      // Reset door swing ticks
      // @Cleanup @Hack: This check is necessary as this function is called as soon as a hut is created, when the components haven't been added yet
      if (HutComponentArray.hasComponent(hut)) {
         const hutComponent = HutComponentArray.getComponent(hut.id);
         hutComponent.lastDoorSwingTicks = Board.ticks;
      }
      
      // Offset the spawn position so the tribesman comes out of the correct side of the hut
      const position = new Point(hut.position.x + 10 * Math.sin(hut.rotation), hut.position.y + 10 * Math.cos(hut.rotation));
      
      let tribesman: Entity;
      if (hut.type === IEntityType.workerHut) {
         tribesman = createTribeWorker(position, this, hut.id);
      } else {
         tribesman = createTribeWarrior(position, this, hut.id);
      }
      // @Incomplete: Will make hitboxes dirty!!
      tribesman.rotation = hut.rotation;

      this.registerNewTribeMember(tribesman);
   }

   public registerNewTribeMember(tribeMember: Entity): void {
      this.friendlyTribesmenIDs.push(tribeMember.id);
   }

   public registerTribeMemberDeath(tribeMember: Entity): void {
      const idx = this.friendlyTribesmenIDs.indexOf(tribeMember.id);
      if (idx !== -1) {
         this.friendlyTribesmenIDs.splice(idx, 1);
      }
   }

   public getNumHuts(): number {
      return this.huts.length;
   }

   /** Destroys the tribe and all its associated buildings */
   // @Incomplete
   private destroy(): void {
      // Remove huts
      for (const hut of this.huts) {
         hut.remove();
      }

      Board.removeTribe(this);
   }

   private createTribeAreaAroundBuilding(buildingPosition: Point, influence: number): void {
      const minTileX = clampToBoardDimensions(Math.floor((buildingPosition.x - influence) / SettingsConst.TILE_SIZE));
      const maxTileX = clampToBoardDimensions(Math.floor((buildingPosition.x + influence) / SettingsConst.TILE_SIZE));
      const minTileY = clampToBoardDimensions(Math.floor((buildingPosition.y - influence) / SettingsConst.TILE_SIZE));
      const maxTileY = clampToBoardDimensions(Math.floor((buildingPosition.y + influence) / SettingsConst.TILE_SIZE));

      for (let tileX = minTileX; tileX <= maxTileX; tileX++) {
         for (let tileY = minTileY; tileY <= maxTileY; tileY++) {
            this.addTileToArea(tileX, tileY);
         }
      }
   }

   private removeBuildingFromTiles(buildingPosition: Point, influence: number): void {
      const minTileX = clampToBoardDimensions(Math.floor((buildingPosition.x - influence) / SettingsConst.TILE_SIZE));
      const maxTileX = clampToBoardDimensions(Math.floor((buildingPosition.x + influence) / SettingsConst.TILE_SIZE));
      const minTileY = clampToBoardDimensions(Math.floor((buildingPosition.y - influence) / SettingsConst.TILE_SIZE));
      const maxTileY = clampToBoardDimensions(Math.floor((buildingPosition.y + influence) / SettingsConst.TILE_SIZE));

      for (let tileX = minTileX; tileX <= maxTileX; tileX++) {
         for (let tileY = minTileY; tileY <= maxTileY; tileY++) {
            this.removeTileFromArea(tileX, tileY);
         }
      }
   }

   private removeTileFromArea(tileX: number, tileY: number): void {
      const tileIndex = tileY * SettingsConst.BOARD_DIMENSIONS + tileX;
      
      if (!this.area.hasOwnProperty(tileIndex)) {
         return;
      } else {
         this.area[tileIndex].numInfluences--;
         if (this.area[tileIndex].numInfluences === 0) {
            delete this.area[tileIndex];
         }
      }

      const chunkX = Math.floor(tileX / SettingsConst.CHUNK_SIZE);
      const chunkY = Math.floor(tileY / SettingsConst.CHUNK_SIZE);
      const chunkIndex = chunkY * SettingsConst.BOARD_SIZE + chunkX;
      if (!this.chunkArea.hasOwnProperty(chunkIndex)) {
         return;
      } else {
         this.chunkArea[chunkIndex].numInfluences--;
         if (this.chunkArea[chunkIndex].numInfluences === 0) {
            delete this.chunkArea[chunkIndex];
         }
      }
   }

   private addTileToArea(tileX: number, tileY: number): void {
      const tileIndex = tileY * SettingsConst.BOARD_DIMENSIONS + tileX;
      
      if (!this.area.hasOwnProperty(tileIndex)) {
         // If the tile isn't in the area, create a new record
         const tile = Board.getTile(tileX, tileY);
         this.area[tileIndex] = {
            tile: tile,
            numInfluences: 1
         };
      } else {
         this.area[tileIndex].numInfluences++;
      }

      const chunkX = Math.floor(tileX / SettingsConst.CHUNK_SIZE);
      const chunkY = Math.floor(tileY / SettingsConst.CHUNK_SIZE);
      const chunkIndex = chunkY * SettingsConst.BOARD_SIZE + chunkX;
      if (!this.chunkArea.hasOwnProperty(chunkIndex)) {
         const chunk = Board.getChunk(chunkX, chunkY);
         this.chunkArea[chunkIndex] = {
            chunk: chunk,
            numInfluences: 1
         };
      } else {
         this.chunkArea[chunkIndex].numInfluences++;
      }
   }

   public tileIsInArea(tileX: number, tileY: number): boolean {
      const tileIndex = tileY * SettingsConst.BOARD_DIMENSIONS + tileX;
      return this.area.hasOwnProperty(tileIndex);
   }

   public numTiles(): number {
      return Object.keys(this.area).length;
   }

   public addBarrel(barrel: Entity): void {
      this.barrels.push(barrel);
      this.addBuilding(barrel);
   }

   public removeBarrel(barrel: Entity): void {
      const idx = this.barrels.indexOf(barrel);
      if (idx !== -1) {
         this.barrels.splice(idx, 1);
      }
      this.removeBuilding(barrel);
   }

   public hasBarrel(barrel: Entity): boolean {
      return this.barrels.includes(barrel);
   }

   public getArea(): Array<Tile> {
      const area = new Array<Tile>();
      for (const tileInfluence of Object.values(this.area)) {
         area.push(tileInfluence.tile);
      }
      return area;
   }

   public studyTech(researcherX: number, researcherY: number, studyAmount: number): void {
      if (this.selectedTechID === null) {
         return;
      }

      if (!this.techTreeUnlockProgress.hasOwnProperty(this.selectedTechID)) {
         this.techTreeUnlockProgress[this.selectedTechID] = {
            itemProgress: {},
            studyProgress: studyAmount
         }
      } else {
         this.techTreeUnlockProgress[this.selectedTechID]!.studyProgress += studyAmount;
         
         // Don't go over the study requirements
         const techInfo = getTechByID(this.selectedTechID);
         if (this.techTreeUnlockProgress[this.selectedTechID]!.studyProgress > techInfo.researchStudyRequirements) {
            this.techTreeUnlockProgress[this.selectedTechID]!.studyProgress = techInfo.researchStudyRequirements;
         }
      }

      SERVER.registerResearchOrbComplete({
         x: researcherX,
         y: researcherY,
         amount: studyAmount
      });
   }

   public hasUnlockedTech(techID: TechID): boolean {
      return this.unlockedTechs.indexOf(techID) !== -1;
   }

   public unlockAllTechs(): void {
      for (const techInfo of TECHS) {
         if (this.hasUnlockedTech(techInfo.id) || techInfo.blacklistedTribes.includes(this.type)) {
            continue;
         }

         if (!this.techTreeUnlockProgress.hasOwnProperty(techInfo.id)) {
            this.techTreeUnlockProgress[techInfo.id] = {
               itemProgress: {},
               studyProgress: 0
            }
         }
         this.techTreeUnlockProgress[techInfo.id]!.studyProgress = techInfo.researchStudyRequirements;
         for (const [itemType, itemAmount] of Object.entries(techInfo.researchItemRequirements)) {
            this.techTreeUnlockProgress[techInfo.id]!.itemProgress[itemType as unknown as ItemType] = itemAmount;
         }
         
         this.unlockTech(techInfo.id);
      }
   }

   public currentTechRequiresResearching(): boolean {
      if (this.selectedTechID === null) {
         return false;
      }

      if (!this.techTreeUnlockProgress.hasOwnProperty(this.selectedTechID)) {
         return true;
      }

      const techInfo = getTechByID(this.selectedTechID);
      const studyProgress = this.techTreeUnlockProgress[techInfo.id]!.studyProgress;
      return studyProgress < techInfo.researchStudyRequirements;
   }

   public updateAvailableResources(): void {
      const newAvailableResources: Partial<Record<ItemType, number>> = {};
      
      for (let i = 0; i < this.barrels.length; i++) {
         const barrel = this.barrels[i];

         const inventoryComponent = InventoryComponentArray.getComponent(barrel.id);
         const inventory = getInventory(inventoryComponent, "inventory");

         for (let itemSlot = 1; itemSlot <= inventory.width * inventory.height; itemSlot++) {
            if (!inventory.itemSlots.hasOwnProperty(itemSlot)) {
               continue;
            }

            const item = inventory.itemSlots[itemSlot];
            if (!newAvailableResources.hasOwnProperty(item.type)) {
               newAvailableResources[item.type] = item.count;
            } else {
               newAvailableResources[item.type]! += item.count;
            }
         }
      }

      this.availableResources = newAvailableResources;
   }
}

export default Tribe;