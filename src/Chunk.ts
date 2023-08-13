import { RiverSteppingStoneData } from "webgl-test-shared";
import { GameObject } from "./GameObject";
import Particle from "./Particle";
import Projectile from "./Projectile";
import Entity from "./entities/Entity";
import DroppedItem from "./items/DroppedItem";

class Chunk {
   /** Stores all game objects inside the chunk */
   private readonly gameObjects = new Set<GameObject>();
   
   private readonly entities = new Set<Entity>();
   private readonly droppedItems = new Set<DroppedItem>();
   private readonly projectiles = new Set<Projectile>();

   private readonly particles = new Set<Particle>();

   private readonly riverSteppingStones = new Array<RiverSteppingStoneData>();

   public readonly x: number;
   public readonly y: number;

   constructor(x: number, y: number) {
      this.x = x;
      this.y = y;
   }

   public addGameObject(gameObject: GameObject): void {
      this.gameObjects.add(gameObject);

      switch (gameObject.i) {
         case "entity": {
            this.entities.add(gameObject);
            break;
         }
         case "droppedItem": {
            this.droppedItems.add(gameObject);
            break;
         }
         case "projectile": {
            this.projectiles.add(gameObject);
         }
      }
   }

   public removeGameObject(gameObject: GameObject): void {
      this.gameObjects.delete(gameObject);

      switch (gameObject.i) {
         case "entity": {
            this.entities.delete(gameObject);
            break;
         }
         case "droppedItem": {
            this.droppedItems.delete(gameObject);
            break;
         }
         case "projectile": {
            this.projectiles.delete(gameObject);
         }
      }
   }

   public getGameObjects(): Set<GameObject> {
      return this.gameObjects;
   }

   public getEntities(): Set<Entity> {
      return this.entities;
   }

   public getDroppedItems(): Set<DroppedItem> {
      return this.droppedItems;
   }

   public getProjectiles(): Set<Projectile> {
      return this.projectiles;
   }

   public addParticle(particle: Particle): void {
      this.particles.add(particle);
   }

   public removeParticle(particle: Particle): void {
      this.particles.delete(particle);
   }

   public getParticles(): ReadonlySet<Particle> {
      return this.particles;
   }
}

export default Chunk;