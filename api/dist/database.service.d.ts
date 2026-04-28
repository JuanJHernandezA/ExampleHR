import { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Database } from 'sqlite';
export declare class DatabaseService implements OnModuleInit, OnModuleDestroy {
    private db;
    onModuleInit(): Promise<void>;
    onModuleDestroy(): Promise<void>;
    get connection(): Database;
    private createSchema;
}
