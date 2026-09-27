CREATE TABLE `data_revisions` (
	`id` text PRIMARY KEY NOT NULL,
	`revision` integer NOT NULL
);

--> statement-breakpoint
CREATE TRIGGER revision_topics_insert AFTER INSERT ON topics BEGIN
 INSERT INTO data_revisions(id,revision) VALUES('content',1)
 ON CONFLICT(id) DO UPDATE SET revision=revision+1;
END;

--> statement-breakpoint
CREATE TRIGGER revision_topics_update AFTER UPDATE ON topics BEGIN
 INSERT INTO data_revisions(id,revision) VALUES('content',1)
 ON CONFLICT(id) DO UPDATE SET revision=revision+1;
END;

--> statement-breakpoint
CREATE TRIGGER revision_topics_delete AFTER DELETE ON topics BEGIN
 INSERT INTO data_revisions(id,revision) VALUES('content',1)
 ON CONFLICT(id) DO UPDATE SET revision=revision+1;
END;

--> statement-breakpoint
CREATE TRIGGER revision_article_versions_insert AFTER INSERT ON article_versions BEGIN
 INSERT INTO data_revisions(id,revision) VALUES('content',1)
 ON CONFLICT(id) DO UPDATE SET revision=revision+1;
END;

--> statement-breakpoint
CREATE TRIGGER revision_article_versions_update AFTER UPDATE ON article_versions BEGIN
 INSERT INTO data_revisions(id,revision) VALUES('content',1)
 ON CONFLICT(id) DO UPDATE SET revision=revision+1;
END;

--> statement-breakpoint
CREATE TRIGGER revision_article_versions_delete AFTER DELETE ON article_versions BEGIN
 INSERT INTO data_revisions(id,revision) VALUES('content',1)
 ON CONFLICT(id) DO UPDATE SET revision=revision+1;
END;

--> statement-breakpoint
CREATE TRIGGER revision_article_analyses_insert AFTER INSERT ON article_analyses BEGIN
 INSERT INTO data_revisions(id,revision) VALUES('content',1)
 ON CONFLICT(id) DO UPDATE SET revision=revision+1;
END;

--> statement-breakpoint
CREATE TRIGGER revision_article_analyses_update AFTER UPDATE ON article_analyses BEGIN
 INSERT INTO data_revisions(id,revision) VALUES('content',1)
 ON CONFLICT(id) DO UPDATE SET revision=revision+1;
END;

--> statement-breakpoint
CREATE TRIGGER revision_article_analyses_delete AFTER DELETE ON article_analyses BEGIN
 INSERT INTO data_revisions(id,revision) VALUES('content',1)
 ON CONFLICT(id) DO UPDATE SET revision=revision+1;
END;

--> statement-breakpoint
CREATE TRIGGER revision_source_coverage_insert AFTER INSERT ON source_coverage BEGIN
 INSERT INTO data_revisions(id,revision) VALUES('content',1)
 ON CONFLICT(id) DO UPDATE SET revision=revision+1;
END;

--> statement-breakpoint
CREATE TRIGGER revision_source_coverage_update AFTER UPDATE ON source_coverage BEGIN
 INSERT INTO data_revisions(id,revision) VALUES('content',1)
 ON CONFLICT(id) DO UPDATE SET revision=revision+1;
END;

--> statement-breakpoint
CREATE TRIGGER revision_source_coverage_delete AFTER DELETE ON source_coverage BEGIN
 INSERT INTO data_revisions(id,revision) VALUES('content',1)
 ON CONFLICT(id) DO UPDATE SET revision=revision+1;
END;
