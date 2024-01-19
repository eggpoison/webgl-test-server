import { IEntityType, ItemType, Point, SETTINGS, TECHS, TRIBE_INFO_RECORD, TechID, TechTreeUnlockProgress, TribeType, clampToBoardDimensions, getTechByID } from "webgl-test-shared";
import Board from "./Board";
import Tile from "./Tile";
import Chunk from "./Chunk";
import Entity from "./Entity";
import { HutComponentArray, TotemBannerComponentArray } from "./components/ComponentArray";
import { createTribeWorker } from "./entities/tribes/tribe-worker";
import { TotemBannerComponent, addBannerToTotem, removeBannerFromTotem } from "./components/TotemBannerComponent";
import { createTribeWarrior } from "./entities/tribes/tribe-warrior";

const RESPAWN_TIME_TICKS = 5 * SETTINGS.TPS;

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

interface ReinforcementInfo {
   readonly targetEntity: Entity;
   secondsSinceNotice: number;
}

class Tribe {
   private static readonly REINFORCEMENT_NOTICE_DURATION_SECONDS = 60;
   
   public readonly id: number;
   
   public readonly type: TribeType;

   public totem: Entity | null = null;
   
   // @Cleanup: Do we actually use this at all?
   private readonly members = new Array<Entity>();

   // /** Stores all tribe huts belonging to the tribe */
   private readonly huts = new Array<Entity>();

   public barrels = new Array<Entity>();

   /** Stores all tiles in the tribe's zone of influence */
   private area: Record<number, TileInfluence> = {};
   private chunkArea: Record<number, ChunkInfluence> = {};

   public tribesmanCap: number;

   public readonly reinforcementInfoArray = new Array<ReinforcementInfo>();

   public selectedTechID: TechID | null = null;
   public readonly unlockedTechs = new Array<TechID>();
   public readonly techTreeUnlockProgress: TechTreeUnlockProgress = {};

   private readonly respawnTimesRemaining = new Array<number>();
   private readonly respawnHutIDs = new Array<number>();
   
   constructor(tribeType: TribeType) {
      this.id = getAvailableID();
      this.type = tribeType;

      this.tribesmanCap = TRIBE_INFO_RECORD[tribeType].baseTribesmanCap;

      Board.addTribe(this);
   }

   public setTotem(totem: Entity): void {
      if (this.totem !== null) {
         console.warn("Tribe already has a totem.");
         return;
      }

      this.totem = totem;

      this.createTribeAreaAroundBuilding(totem.position, TRIBE_BUILDING_AREA_INFLUENCES[IEntityType.tribeTotem]);
   }

   public clearTotem(): void {
      if (this.totem === null) {
         return;
      }

      this.totem = null;
      this.destroy();
   }

   public unlockTech(techID: TechID): void {
      if (!this.unlockedTechs.includes(techID)) {
         this.unlockedTechs.push(techID);
         this.selectedTechID = null;
      }
   }

   public tick(): void {
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
      
      // @Temporary
      for (let i = 0; i < this.reinforcementInfoArray.length; i++) {
         const info = this.reinforcementInfoArray[i];

         // Remove notices for removed entities
         if (info.targetEntity.isRemoved) {
            this.reinforcementInfoArray.splice(i, 1);
            i--;
            continue;
         }

         // Remove old notices
         info.secondsSinceNotice += 1 / SETTINGS.TPS;
         if (info.secondsSinceNotice >= Tribe.REINFORCEMENT_NOTICE_DURATION_SECONDS) {
            this.reinforcementInfoArray.splice(i, 1);
            i--;
         }
      }
   }

   public addTribeMember(member: Entity): void {
      this.members.push(member);
   }

   public registerNewWorkerHut(workerHut: Entity): void {
      if (this.totem === null) {
         console.warn("Can't register hut without a tribe.");
         return;
      }

      this.huts.push(workerHut);

      // Create a tribesman for the hut
      this.createNewTribesman(workerHut);

      this.createTribeAreaAroundBuilding(workerHut.position, TRIBE_BUILDING_AREA_INFLUENCES[IEntityType.workerHut]);
      
      // @Hack
      let bannerComponent: TotemBannerComponent;
      if (TotemBannerComponentArray.hasComponent(this.totem)) {
         bannerComponent = TotemBannerComponentArray.getComponent(this.totem);
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

      // Create a tribesman for the hut
      this.createNewTribesman(warriorHut);

      this.createTribeAreaAroundBuilding(warriorHut.position, TRIBE_BUILDING_AREA_INFLUENCES[IEntityType.warriorHut]);
      
      // @Hack
      let bannerComponent: TotemBannerComponent;
      if (TotemBannerComponentArray.hasComponent(this.totem)) {
         bannerComponent = TotemBannerComponentArray.getComponent(this.totem);
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

      if (this.totem !== null) {
         const bannerComponent = TotemBannerComponentArray.getComponent(this.totem);
         removeBannerFromTotem(bannerComponent, idx);
      }

      this.removeBuildingFromTiles(hut.position, TRIBE_BUILDING_AREA_INFLUENCES[IEntityType.workerHut]);
   }

   public removeWarriorHut(hut: Entity): void {
      const idx = this.huts.indexOf(hut);
      if (idx !== -1) {
         this.huts.splice(idx, 1);
      }

      if (this.totem !== null) {
         const bannerComponent = TotemBannerComponentArray.getComponent(this.totem);
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
         const hutComponent = HutComponentArray.getComponent(hut);
         hutComponent.lastDoorSwingTicks = Board.ticks;
      }
      
      // @Speed: garbage
      // Offset the spawn position so the tribesman comes out of the correct side of the hut
      const position = hut.position.copy();
      const offset = Point.fromVectorForm(10, hut.rotation);
      position.add(offset);
      
      let tribesman: Entity;
      if (hut.type === IEntityType.workerHut) {
         tribesman = createTribeWorker(position, this, hut.id);
      } else {
         tribesman = createTribeWarrior(position, this, hut.id);
      }
      tribesman.rotation = hut.rotation;

      this.members.push(tribesman);
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
      const minTileX = clampToBoardDimensions(Math.floor((buildingPosition.x - influence) / SETTINGS.TILE_SIZE));
      const maxTileX = clampToBoardDimensions(Math.floor((buildingPosition.x + influence) / SETTINGS.TILE_SIZE));
      const minTileY = clampToBoardDimensions(Math.floor((buildingPosition.y - influence) / SETTINGS.TILE_SIZE));
      const maxTileY = clampToBoardDimensions(Math.floor((buildingPosition.y + influence) / SETTINGS.TILE_SIZE));

      for (let tileX = minTileX; tileX <= maxTileX; tileX++) {
         for (let tileY = minTileY; tileY <= maxTileY; tileY++) {
            this.addTileToArea(tileX, tileY);
         }
      }
   }

   private removeBuildingFromTiles(buildingPosition: Point, influence: number): void {
      const minTileX = clampToBoardDimensions(Math.floor((buildingPosition.x - influence) / SETTINGS.TILE_SIZE));
      const maxTileX = clampToBoardDimensions(Math.floor((buildingPosition.x + influence) / SETTINGS.TILE_SIZE));
      const minTileY = clampToBoardDimensions(Math.floor((buildingPosition.y - influence) / SETTINGS.TILE_SIZE));
      const maxTileY = clampToBoardDimensions(Math.floor((buildingPosition.y + influence) / SETTINGS.TILE_SIZE));

      for (let tileX = minTileX; tileX <= maxTileX; tileX++) {
         for (let tileY = minTileY; tileY <= maxTileY; tileY++) {
            this.removeTileFromArea(tileX, tileY);
         }
      }
   }

   private removeTileFromArea(tileX: number, tileY: number): void {
      const tileIndex = tileY * SETTINGS.BOARD_DIMENSIONS + tileX;
      
      if (!this.area.hasOwnProperty(tileIndex)) {
         return;
      } else {
         this.area[tileIndex].numInfluences--;
         if (this.area[tileIndex].numInfluences === 0) {
            delete this.area[tileIndex];
         }
      }

      const chunkX = Math.floor(tileX / SETTINGS.CHUNK_SIZE);
      const chunkY = Math.floor(tileY / SETTINGS.CHUNK_SIZE);
      const chunkIndex = chunkY * SETTINGS.BOARD_SIZE + chunkX;
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
      const tileIndex = tileY * SETTINGS.BOARD_DIMENSIONS + tileX;
      
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

      const chunkX = Math.floor(tileX / SETTINGS.CHUNK_SIZE);
      const chunkY = Math.floor(tileY / SETTINGS.CHUNK_SIZE);
      const chunkIndex = chunkY * SETTINGS.BOARD_SIZE + chunkX;
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
      const tileIndex = tileY * SETTINGS.BOARD_DIMENSIONS + tileX;
      return this.area.hasOwnProperty(tileIndex);
   }

   public numTiles(): number {
      return Object.keys(this.area).length;
   }

   public addBarrel(barrel: Entity): void {
      this.barrels.push(barrel);
   }

   public hasBarrel(barrel: Entity): boolean {
      return this.barrels.includes(barrel);
   }

   public getArea(): ReadonlyArray<Tile> {
      const area = new Array<Tile>();
      for (const tileInfluence of Object.values(this.area)) {
         area.push(tileInfluence.tile);
      }
      return area;
   }

   public requestReinforcements(target: Entity): void {
      let idx = -1;
      for (let i = 0; i < this.reinforcementInfoArray.length; i++) {
         const reinforcementInfo = this.reinforcementInfoArray[i];
         if (reinforcementInfo.targetEntity === target) {
            idx = i;
         }
      }

      if (idx === -1) {
         this.reinforcementInfoArray.push({
            targetEntity: target,
            secondsSinceNotice: 0
         });
      } else {
         this.reinforcementInfoArray[idx].secondsSinceNotice = 0;
      }
   }

   public studyTech(studyAmount: number): void {
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
}

export default Tribe;