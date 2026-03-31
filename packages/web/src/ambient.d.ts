declare module 'three-mesh-bvh/src/workers/GenerateMeshBVHWorker.js' {
  export class GenerateMeshBVHWorker {
    constructor();
    generate(geometry: any, options?: any): Promise<any>;
    dispose(): void;
  }
}
