-- 核心数据结构（可映射到微信云开发数据库或MySQL）

CREATE TABLE users (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  openid VARCHAR(64) NOT NULL UNIQUE,
  nickname VARCHAR(64),
  avatar_url VARCHAR(255),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE vip_subscriptions (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  plan_type VARCHAR(32) NOT NULL DEFAULT 'monthly',
  status VARCHAR(32) NOT NULL DEFAULT 'inactive',
  start_time DATETIME,
  end_time DATETIME,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user_status (user_id, status)
);

CREATE TABLE matches (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  source VARCHAR(32) NOT NULL,
  source_match_id VARCHAR(64) NOT NULL,
  league_name VARCHAR(64) NOT NULL,
  match_time DATETIME NOT NULL,
  home_team VARCHAR(64) NOT NULL,
  away_team VARCHAR(64) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'upcoming',
  final_score VARCHAR(16),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_source_match (source, source_match_id),
  INDEX idx_match_time (match_time)
);

CREATE TABLE odds_snapshots (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  match_id BIGINT NOT NULL,
  snapshot_time DATETIME NOT NULL,
  win_odds DECIMAL(8,3),
  draw_odds DECIMAL(8,3),
  lose_odds DECIMAL(8,3),
  handicap_line VARCHAR(16),
  over_under_line VARCHAR(16),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_match_time (match_id, snapshot_time)
);

CREATE TABLE team_ratings (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  team_name VARCHAR(64) NOT NULL,
  league_name VARCHAR(64),
  elo_rating DECIMAL(10,2) NOT NULL,
  bt_strength DECIMAL(10,4),
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_team_league (team_name, league_name)
);

CREATE TABLE predictions (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  match_id BIGINT NOT NULL,
  model_version VARCHAR(32) NOT NULL,
  predict_time DATETIME NOT NULL,
  prob_win DECIMAL(6,4) NOT NULL,
  prob_draw DECIMAL(6,4) NOT NULL,
  prob_lose DECIMAL(6,4) NOT NULL,
  prob_handicap_win DECIMAL(6,4),
  prob_handicap_draw DECIMAL(6,4),
  prob_handicap_lose DECIMAL(6,4),
  top_score_1 VARCHAR(16),
  top_score_1_prob DECIMAL(6,4),
  top_score_2 VARCHAR(16),
  top_score_2_prob DECIMAL(6,4),
  top_score_3 VARCHAR(16),
  top_score_3_prob DECIMAL(6,4),
  reason_text TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_match_predict_time (match_id, predict_time)
);

CREATE TABLE prediction_results (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  prediction_id BIGINT NOT NULL,
  final_score VARCHAR(16),
  hit_wdl TINYINT NOT NULL DEFAULT 0,
  hit_score TINYINT NOT NULL DEFAULT 0,
  hit_goals_range TINYINT NOT NULL DEFAULT 0,
  settled_at DATETIME,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_prediction_id (prediction_id)
);

CREATE TABLE model_configs (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  model_version VARCHAR(32) NOT NULL,
  elo_weight DECIMAL(6,4) NOT NULL,
  bt_weight DECIMAL(6,4) NOT NULL,
  mc_weight DECIMAL(6,4) NOT NULL,
  risk_style VARCHAR(16) NOT NULL DEFAULT 'steady',
  auto_tune_enabled TINYINT NOT NULL DEFAULT 1,
  manual_override_enabled TINYINT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
