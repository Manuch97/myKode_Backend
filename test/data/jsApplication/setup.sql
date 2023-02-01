--setuser 'amministrazione'
SET NOCOUNT ON

--[DBO]--

-- CREAZIONE TABELLA web_listredir --
IF NOT EXISTS(select * from sysobjects where id = object_id(N'[dbo].[web_listredir]') and OBJECTPROPERTY(id, N'IsUserTable') = 1)
BEGIN
CREATE TABLE [dbo].[web_listredir] (
tablename varchar(50) NOT NULL,
listtype varchar(50) NOT NULL,
ct datetime NULL,
cu varchar(64) NULL,
lt datetime NULL,
lu varchar(64) NULL,
newlisttype varchar(50) NULL,
newtablename varchar(50) NULL,
 CONSTRAINT xpkweb_listredir PRIMARY KEY (tablename,listtype
)
)
END
GO

delete from web_listredir
GO


-- CREAZIONE TABELLA customuser --
IF NOT EXISTS(select * from sysobjects where id = object_id(N'[dbo].[customuser]') and OBJECTPROPERTY(id, N'IsUserTable') = 1)
BEGIN
CREATE TABLE [dbo].[customuser] (
idcustomuser varchar(50) NOT NULL,
ct datetime NULL,
cu varchar(64) NULL,
lastmodtimestamp datetime NULL,
lastmoduser varchar(64) NULL,
lt datetime NULL,
lu varchar(64) NULL,
username varchar(50) NOT NULL,
 CONSTRAINT xpkcustomuser PRIMARY KEY (idcustomuser
)
)
END
GO

delete from customuser 
GO


-- CREAZIONE TABELLA customgroup 
IF NOT EXISTS(select * from sysobjects where id = object_id(N'[dbo].[customgroup]') and OBJECTPROPERTY(id, N'IsUserTable') = 1)
BEGIN
CREATE TABLE [dbo].[customgroup] (
idcustomgroup varchar(50) NOT NULL,
ct datetime NULL,
cu varchar(64) NULL,
description varchar(200) NULL,
groupname varchar(80) NULL,
lastmodtimestamp datetime NULL,
lastmoduser varchar(64) NULL,
lt datetime NULL,
lu varchar(64) NULL,
 CONSTRAINT xpkcustomgroup PRIMARY KEY (idcustomgroup
)
)
END
GO

-- CREAZIONE TABELLA customusergroup --
IF NOT EXISTS(select * from sysobjects where id = object_id(N'[dbo].[customusergroup]') and OBJECTPROPERTY(id, N'IsUserTable') = 1)
BEGIN
CREATE TABLE [dbo].[customusergroup] (
idcustomgroup varchar(50) NOT NULL,
idcustomuser varchar(50) NOT NULL,
ct datetime NULL,
cu varchar(64) NULL,
lastmodtimestamp datetime NULL,
lastmoduser varchar(64) NULL,
lt datetime NULL,
lu varchar(64) NULL,
 CONSTRAINT xpkcustomusergroup PRIMARY KEY (idcustomgroup,
idcustomuser
)
)
END
GO

-- CREAZIONE TABELLA customgroupoperation --
IF NOT EXISTS(select * from sysobjects where id = object_id(N'[dbo].[customgroupoperation]') and OBJECTPROPERTY(id, N'IsUserTable') = 1)
BEGIN
CREATE TABLE [dbo].[customgroupoperation] (
idgroup varchar(50) NOT NULL,
operation char(1) NOT NULL,
tablename varchar(50) NOT NULL,
allowcondition text NULL,
ct datetime NULL,
cu varchar(64) NULL,
defaultisdeny char(1) NOT NULL,
denycondition text NULL,
lastmodtimestamp datetime NULL,
lastmoduser varchar(64) NULL,
lt datetime NULL,
lu varchar(64) NULL,
 CONSTRAINT xpkcustomgroupoperation PRIMARY KEY (idgroup,
operation,
tablename
)
)
END
GO

-- CREAZIONE TABELLA flowchart --
IF NOT EXISTS(select * from sysobjects where id = object_id(N'[flowchart]') and OBJECTPROPERTY(id, N'IsUserTable') = 1)
BEGIN
CREATE TABLE [flowchart] (
idflowchart varchar(34) NOT NULL,
address varchar(100) NULL,
ayear int NULL,
cap varchar(20) NULL,
codeflowchart varchar(50) NOT NULL,
ct datetime NOT NULL,
cu varchar(64) NOT NULL,
fax varchar(75) NULL,
idcity int NULL,
idsor1 int NULL,
idsor2 int NULL,
idsor3 int NULL,
location varchar(50) NULL,
lt datetime NOT NULL,
lu varchar(64) NOT NULL,
nlevel int NOT NULL,
paridflowchart varchar(34) NOT NULL,
phone varchar(55) NULL,
printingorder varchar(50) NOT NULL,
title varchar(150) NOT NULL,
 CONSTRAINT xpkflowchart PRIMARY KEY (idflowchart
)
)
END
GO


-- CREAZIONE TABELLA flowchartuser --
IF NOT EXISTS(select * from sysobjects where id = object_id(N'[flowchartuser]') and OBJECTPROPERTY(id, N'IsUserTable') = 1)
BEGIN
CREATE TABLE [flowchartuser] (
idflowchart varchar(34) NOT NULL,
ndetail int NOT NULL,
idcustomuser varchar(50) NOT NULL,
all_sorkind01 char(1) NULL,
all_sorkind02 char(1) NULL,
all_sorkind03 char(1) NULL,
all_sorkind04 char(1) NULL,
all_sorkind05 char(1) NULL,
ct datetime NOT NULL,
cu varchar(64) NOT NULL,
flagdefault char(1) NOT NULL,
idsor01 int NULL,
idsor02 int NULL,
idsor03 int NULL,
idsor04 int NULL,
idsor05 int NULL,
lt datetime NOT NULL,
lu varchar(64) NOT NULL,
sorkind01_withchilds char(1) NULL,
sorkind02_withchilds char(1) NULL,
sorkind03_withchilds char(1) NULL,
sorkind04_withchilds char(1) NULL,
sorkind05_withchilds char(1) NULL,
start date NULL,
stop date NULL,
title varchar(150) NULL,
 CONSTRAINT xpkflowchartuser PRIMARY KEY (idflowchart,
ndetail,
idcustomuser
)
)
END
GO

delete from flowchartuser
GO

-- CREAZIONE TABELLA menu --
IF NOT EXISTS(select * from sysobjects where id = object_id(N'[menu]') and OBJECTPROPERTY(id, N'IsUserTable') = 1)
BEGIN
CREATE TABLE [menu] (
idmenu int NOT NULL,
edittype varchar(60) NULL,
lt datetime NULL,
lu varchar(64) NULL,
menucode varchar(80) NULL,
metadata varchar(60) NULL,
modal char(1) NULL,
ordernumber int NULL,
parameter varchar(80) NULL,
paridmenu int NULL,
title varchar(80) NOT NULL,
userid varchar(80) NULL,
 CONSTRAINT xpkmenu PRIMARY KEY (idmenu
)
)
END
GO
delete from menu
GO


-- GENERAZIONE DATI PER customuser --
IF not exists(SELECT * FROM [customuser] WHERE idcustomuser = 'AZZURRO')
INSERT INTO [customuser] (idcustomuser,ct,cu,lastmodtimestamp,lastmoduser,lt,lu,username) VALUES ('AZZURRO',{ts '2011-10-18 11:11:10.937'},'sa',null,null,{ts '2011-10-18 11:11:10.937'},'sa','AZZURRO')
IF not exists(SELECT * FROM [customuser] WHERE idcustomuser = 'BIANCO')
INSERT INTO [customuser] (idcustomuser,ct,cu,lastmodtimestamp,lastmoduser,lt,lu,username) VALUES ('BIANCO',{ts '2011-04-07 13:06:12.157'},'sa',null,null,{ts '2011-04-07 13:06:12.157'},'sa','BIANCO')
IF not exists(SELECT * FROM [customuser] WHERE idcustomuser = 'MARIO.ROSSI')
INSERT INTO [customuser] (idcustomuser,ct,cu,lastmodtimestamp,lastmoduser,lt,lu,username) VALUES ('MARIO.ROSSI',{ts '2011-06-27 14:12:40.297'},'sa',null,null,{ts '2011-06-27 14:12:40.297'},'sa','MARIO.ROSSI')
IF not exists(SELECT * FROM [customuser] WHERE idcustomuser = 'NERO')
INSERT INTO [customuser] (idcustomuser,ct,cu,lastmodtimestamp,lastmoduser,lt,lu,username) VALUES ('NERO',{ts '2011-04-07 13:06:21.670'},'sa',null,null,{ts '2011-04-07 13:06:21.670'},'sa','NERO')
IF not exists(SELECT * FROM [customuser] WHERE idcustomuser = 'nino')
INSERT INTO [customuser] (idcustomuser,ct,cu,lastmodtimestamp,lastmoduser,lt,lu,username) VALUES ('nino',{ts '2015-06-05 15:29:32.073'},'Nino',null,null,{ts '2015-06-05 15:29:32.073'},'Nino','nino')
IF not exists(SELECT * FROM [customuser] WHERE idcustomuser = 'PROVA.SICUREZZA')
INSERT INTO [customuser] (idcustomuser,ct,cu,lastmodtimestamp,lastmoduser,lt,lu,username) VALUES ('PROVA.SICUREZZA',{ts '2012-10-25 11:52:41.093'},'sa',null,null,{ts '2012-10-25 11:52:41.093'},'sa','PROVA.SICUREZZA')
IF not exists(SELECT * FROM [customuser] WHERE idcustomuser = 'ROSA')
INSERT INTO [customuser] (idcustomuser,ct,cu,lastmodtimestamp,lastmoduser,lt,lu,username) VALUES ('ROSA',{ts '2011-10-24 16:43:06.687'},'sa',null,null,{ts '2011-10-24 16:43:06.687'},'sa','ROSA')
IF not exists(SELECT * FROM [customuser] WHERE idcustomuser = 'sara')
INSERT INTO [customuser] (idcustomuser,ct,cu,lastmodtimestamp,lastmoduser,lt,lu,username) VALUES ('sara',{ts '2009-12-09 09:29:44.780'},'SARA',null,null,{ts '2009-12-09 09:29:44.780'},'SARA','SARA')
IF not exists(SELECT * FROM [customuser] WHERE idcustomuser = 'UTENTE')
INSERT INTO [customuser] (idcustomuser,ct,cu,lastmodtimestamp,lastmoduser,lt,lu,username) VALUES ('UTENTE',{ts '2009-12-09 09:29:44.780'},'UTENTE',null,null,{ts '2009-12-09 09:29:44.780'},'UTENTE','UTENTE')
GO




-- GENERAZIONE DATI PER customgroup --

IF exists(SELECT * FROM [customgroup] WHERE idcustomgroup = 'ORGANIGRAMMA')
UPDATE [customgroup] SET ct = {ts '2007-06-22 14:21:39.013'},cu = 'sa',description = 'Organigramma',groupname = 'Organigramma',lastmodtimestamp = {ts '2007-06-22 14:21:39.013'},lastmoduser = 'sa',lt = {ts '2007-06-22 14:21:39.013'},lu = '''sa''' WHERE idcustomgroup = 'ORGANIGRAMMA'
ELSE
INSERT INTO [customgroup] (idcustomgroup,ct,cu,description,groupname,lastmodtimestamp,lastmoduser,lt,lu) VALUES ('ORGANIGRAMMA',{ts '2007-06-22 14:21:39.013'},'sa','Organigramma','Organigramma',{ts '2007-06-22 14:21:39.013'},'sa',{ts '2007-06-22 14:21:39.013'},'''sa''')
GO


IF not exists(SELECT * FROM [customusergroup] WHERE idcustomgroup = 'ORGANIGRAMMA' AND idcustomuser = 'AZZURRO')
INSERT INTO [customusergroup] (idcustomgroup,idcustomuser,ct,cu,lastmodtimestamp,lastmoduser,lt,lu) VALUES ('ORGANIGRAMMA','AZZURRO',{ts '2011-10-18 11:11:12.563'},'sa',{ts '2011-10-18 11:11:12.420'},'Software and More',{ts '2011-10-18 11:11:12.563'},'sa')
IF not exists(SELECT * FROM [customusergroup] WHERE idcustomgroup = 'ORGANIGRAMMA' AND idcustomuser = 'BIANCO')
INSERT INTO [customusergroup] (idcustomgroup,idcustomuser,ct,cu,lastmodtimestamp,lastmoduser,lt,lu) VALUES ('ORGANIGRAMMA','BIANCO',{ts '2012-06-05 11:47:01.327'},'sa',null,null,{ts '2012-06-05 11:47:01.327'},'sa')
IF not exists(SELECT * FROM [customusergroup] WHERE idcustomgroup = 'ORGANIGRAMMA' AND idcustomuser = 'MARIO.ROSSI')
INSERT INTO [customusergroup] (idcustomgroup,idcustomuser,ct,cu,lastmodtimestamp,lastmoduser,lt,lu) VALUES ('ORGANIGRAMMA','MARIO.ROSSI',{ts '2011-06-27 14:12:42.127'},'sa',{ts '2011-06-27 14:12:41.610'},'Software and More',{ts '2011-06-27 14:12:42.127'},'sa')
IF not exists(SELECT * FROM [customusergroup] WHERE idcustomgroup = 'ORGANIGRAMMA' AND idcustomuser = 'NERO')
INSERT INTO [customusergroup] (idcustomgroup,idcustomuser,ct,cu,lastmodtimestamp,lastmoduser,lt,lu) VALUES ('ORGANIGRAMMA','NERO',{ts '2011-04-07 13:06:22.563'},'sa',{ts '2011-04-07 13:06:22.467'},'Software and More',{ts '2011-04-07 13:06:22.563'},'sa')
GO


IF not exists(SELECT * FROM [customusergroup] WHERE idcustomgroup = 'ORGANIGRAMMA' AND idcustomuser = 'PROVA.SICUREZZA')
INSERT INTO [customusergroup] (idcustomgroup,idcustomuser,ct,cu,lastmodtimestamp,lastmoduser,lt,lu) VALUES ('ORGANIGRAMMA','PROVA.SICUREZZA',{ts '2012-10-25 11:52:42.280'},'sa',{ts '2012-10-25 11:52:42.217'},'Software and More',{ts '2012-10-25 11:52:42.280'},'sa')
IF not exists(SELECT * FROM [customusergroup] WHERE idcustomgroup = 'ORGANIGRAMMA' AND idcustomuser = 'ROSA')
INSERT INTO [customusergroup] (idcustomgroup,idcustomuser,ct,cu,lastmodtimestamp,lastmoduser,lt,lu) VALUES ('ORGANIGRAMMA','ROSA',{ts '2011-10-24 16:43:08.610'},'sa',{ts '2011-10-24 16:43:08.030'},'Software and More',{ts '2011-10-24 16:43:08.610'},'sa')
IF not exists(SELECT * FROM [customusergroup] WHERE idcustomgroup = 'ORGANIGRAMMA' AND idcustomuser = 'sara')
INSERT INTO [customusergroup] (idcustomgroup,idcustomuser,ct,cu,lastmodtimestamp,lastmoduser,lt,lu) VALUES ('ORGANIGRAMMA','sara',{ts '2009-12-09 09:29:45.843'},'SARA',{ts '2009-12-09 09:29:45.733'},'Software and More',{ts '2009-12-09 09:29:45.843'},'SARA')
IF not exists(SELECT * FROM [customusergroup] WHERE idcustomgroup = 'ORGANIGRAMMA' AND idcustomuser = 'UTENTE')
INSERT INTO [customusergroup] (idcustomgroup,idcustomuser,ct,cu,lastmodtimestamp,lastmoduser,lt,lu) VALUES ('ORGANIGRAMMA','UTENTE',{ts '2011-03-01 15:17:18.110'},'sa',{ts '2011-03-01 15:17:17.780'},'Software and More',{ts '2011-03-01 15:17:18.110'},'sa')
IF not exists(SELECT * FROM [customusergroup] WHERE idcustomgroup = 'SPLITPAYMENT' AND idcustomuser = 'PROVA.SICUREZZA')
INSERT INTO [customusergroup] (idcustomgroup,idcustomuser,ct,cu,lastmodtimestamp,lastmoduser,lt,lu) VALUES ('SPLITPAYMENT','PROVA.SICUREZZA',{ts '2015-02-02 14:32:19.390'},'assistenza',null,null,{ts '2015-02-02 14:32:19.390'},'assistenza')
GO

-- FINE GENERAZIONE SCRIPT --
-- CREAZIONE TABELLA userenvironment --
IF NOT EXISTS(select * from sysobjects where id = object_id(N'[userenvironment]') and OBJECTPROPERTY(id, N'IsUserTable') = 1)
BEGIN
CREATE TABLE [userenvironment] (
idcustomuser varchar(50) NOT NULL,
variablename varchar(50) NOT NULL,
flagadmin char(1) NULL,
kind char(1) NULL,
lt datetime NULL,
lu varchar(64) NULL,
value text NULL,
 CONSTRAINT xpkuserenvironment PRIMARY KEY (idcustomuser,
variablename
)
)
END
GO
-- CREAZIONE TABELLA flowchartrestrictedfunction --
IF NOT EXISTS(select * from sysobjects where id = object_id(N'[flowchartrestrictedfunction]') and OBJECTPROPERTY(id, N'IsUserTable') = 1)
BEGIN
CREATE TABLE [flowchartrestrictedfunction] (
idflowchart varchar(34) NOT NULL,
idrestrictedfunction int NOT NULL,
ct datetime NOT NULL,
cu varchar(64) NOT NULL,
lt datetime NOT NULL,
lu varchar(64) NOT NULL,
 CONSTRAINT xpkflowchartrestrictedfunction PRIMARY KEY (idflowchart,
idrestrictedfunction
)
)
END
GO

-- CREAZIONE TABELLA restrictedfunction --
IF NOT EXISTS(select * from sysobjects where id = object_id(N'[dbo].[restrictedfunction]') and OBJECTPROPERTY(id, N'IsUserTable') = 1)
BEGIN
CREATE TABLE [dbo].[restrictedfunction] (
idrestrictedfunction int NOT NULL,
ct datetime NOT NULL,
cu varchar(64) NOT NULL,
description varchar(100) NOT NULL,
lt datetime NOT NULL,
lu varchar(64) NOT NULL,
variablename varchar(50) NOT NULL,
 CONSTRAINT xpkrestrictedfunction PRIMARY KEY (idrestrictedfunction
)
)
END
GO


if exists (select * from dbo.sysobjects where id = object_id(N'[compute_environment]') and OBJECTPROPERTY(id, N'IsProcedure') = 1)
drop procedure [compute_environment]
GO


CREATE  PROCEDURE [compute_environment]
(
	@ayear int,
	@idcustomuser varchar(50),
	@idflowchart varchar(34)= null,
	@ndetail int = null
)
AS BEGIN

	if (@idflowchart is null) begin
		select top (1) @idflowchart=  FU.idflowchart,
					@ndetail=FU.ndetail
				from flowchart F
				join flowchartuser FU ON F.idflowchart=FU.idflowchart
				where FU.idcustomuser = @idcustomuser and
				    (FU.start is null or FU.start <= getdate()) and
					(FU.stop is null or FU.stop >= getdate()) and
					(F.ayear = @ayear)
				ORDER BY FU.flagdefault DESC
		print @idflowchart
		print @ndetail
	end

   if (@idflowchart is not null and @ndetail is null) begin
		select top (1) @ndetail=FU.ndetail
				from flowchart F
				join flowchartuser FU ON F.idflowchart=@idflowchart
				where FU.idcustomuser = @idcustomuser and
				    (FU.start is null or FU.start <= getdate()) and
					(FU.stop is null or FU.stop >= getdate()) and
					(F.ayear = @ayear)
				ORDER BY FU.flagdefault DESC
		print @idflowchart
		print @ndetail
	end

declare @codeflowchart varchar(100)
select  @codeflowchart= codeflowchart from flowchart where idflowchart=@idflowchart


select  @idflowchart as idflowchart, @ndetail as ndetail,
		@codeflowchart as codeflowchart



declare @allvar varchar(30)
set @allvar=null

declare @withchilds char(1)
set @withchilds='N'

declare @all_value char(1)
set @all_value='N'

declare @cond varchar(1000)
set @cond=''

declare @idvar varchar(30)

declare @idlist varchar(max)
set @idlist=''


CREATE TABLE #myouttable
(	variablename varchar(200),
	kind char(1),
	mustquote char(1),
	value text
)

/*
EXEC compute_environment 2021,'AZZURRO',null,null

*/

declare @noflowchart char (1)
set @noflowchart='N'
IF (@ndetail IS NULL OR @ndetail = 0) begin
	SET @noflowchart='S'
	print 'il flowchart non esiste'
END

if (@noflowchart='S') begin
	select * from #myouttable
	drop table #myouttable
	return
end

insert into #myouttable (variablename, kind, value) select variablename, kind, value
	 from userenvironment where idcustomuser=@idcustomuser and kind='K'
--le costanti sono già a posto (kind=K)

--kind=S sono le stored procedures, distinguiamo le compute_set dalla compute_set_withndet
insert into #myouttable (variablename, kind, value,mustquote)
	select variablename, kind,
		case when (exists (SELECT *
						FROM flowchartrestrictedfunction FF
						JOIN restrictedfunction RF		ON RF.idrestrictedfunction = FF.idrestrictedfunction
						WHERE FF.idflowchart = @idflowchart	AND RF.variablename = userenvironment.variablename))
					then 'S'
					else 'N'
		end,'S'
	from userenvironment
	where idcustomuser=@idcustomuser and kind='S' and value like 'compute_set'




DECLARE @nrowfound int

--fare gestione idsor01-05
set @allvar=null
set @all_value='N'
set @withchilds='N'

CREATE TABLE #tab_allowform(	tablename varchar(100))

INSERT  #tab_allowform EXEC compute_allowform @ayear,@idcustomuser,@idflowchart,'menu'


	--menu  compute_allowform
	set @idlist=''
	select @idlist = @idlist+','''+convert(varchar(50),tablename)+''''  from #tab_allowform
    INSERT INTO #myouttable(variablename, kind, value,mustquote)	 VALUES('menu','S',substring(@idlist,2,len(@idlist)),'N')
	drop table #tab_allowform

	--notable   compute_notable
	set @idlist=''
	CREATE TABLE #tab_notable(	edittype varchar(100))
	INSERT  #tab_notable EXEC compute_notable @ayear,@idcustomuser,@idflowchart,'notable'
	select @idlist = @idlist+','''+convert(varchar(30),edittype)+''''  from #tab_notable
    INSERT INTO #myouttable(variablename, kind, value,mustquote)	 VALUES('notable','S',substring(@idlist,2,len(@idlist)),'N')
	drop table #tab_notable

	select * from #myouttable

	drop table #myouttable
END
GO

if exists (select * from dbo.sysobjects where id = object_id(N'[compute_allowform]') and OBJECTPROPERTY(id, N'IsProcedure') = 1)
drop procedure [compute_allowform]
GO

CREATE PROCEDURE [compute_allowform]
(
	@ayear int,
	@iduser varchar(10),
	@idflowchart varchar(34),
	@varname varchar(30)=null
)
AS BEGIN

CREATE TABLE #outtable
(
	tablename varchar(100)
)

IF (@idflowchart IS NULL)
BEGIN
	INSERT INTO #outtable
	SELECT  metadata
	FROM menu
	WHERE metadata IS NOT NULL

	SELECT tablename FROM #outtable where tablename <>'no_table'
	drop table #outtable

	RETURN
END

INSERT INTO #outtable VALUES('resultparameter')
INSERT INTO #outtable VALUES('export')


IF ((SELECT COUNT(*) FROM #outtable) > 0)
BEGIN
	SELECT distinct tablename FROM #outtable where tablename <>'no_table' order by tablename
	drop table #outtable
	RETURN
END

INSERT INTO #outtable VALUES('dummy')
SELECT DISTINCT tablename FROM #outtable order by tablename
drop table #outtable
END

GO



if exists (select * from dbo.sysobjects where id = object_id(N'[compute_notable]') and OBJECTPROPERTY(id, N'IsProcedure') = 1)
drop procedure [compute_notable]
GO

CREATE PROCEDURE compute_notable
(
	@ayear int,
	@iduser varchar(10),
	@idflowchart varchar(34),
	@varname varchar(30)
)
AS BEGIN

CREATE TABLE #outtable
(
	edittype varchar(100)
)

IF (@idflowchart IS NULL)
BEGIN
	INSERT INTO #outtable
	SELECT DISTINCT edittype
	FROM menu
	WHERE metadata = 'no_table'

	SELECT edittype FROM #outtable
	RETURN
END


IF ((SELECT COUNT(*) FROM #outtable) > 0)
BEGIN
	SELECT distinct edittype FROM #outtable order by edittype
	RETURN
END

INSERT INTO #outtable VALUES('dummy')
SELECT edittype FROM #outtable order by edittype
drop table #outtable

END
GO


IF NOT EXISTS(select * from sysobjects where id = object_id(N'[customer]') and OBJECTPROPERTY(id, N'IsUserTable') = 1)
BEGIN
CREATE TABLE customer(
	idcustomer int NOT NULL,
	name varchar(100) NULL,
	age int NULL,
	birth datetime NULL,
	surname varchar(100) NULL,
	stamp datetime NULL,
	random int NULL,
	curr decimal(19,2) NULL,
    CONSTRAINT xpkcustomer PRIMARY KEY  (idcustomer)
) ;
END
GO
delete from customer
GO

if exists (select * from dbo.sysobjects where id = object_id(N'[ctemp]') and OBJECTPROPERTY(id, N'IsProcedure') = 1)
drop procedure ctemp
GO

CREATE PROCEDURE ctemp AS
BEGIN
DECLARE @i int;
SET @i = 1;
while @i < 500 BEGIN
 insert into customer(idcustomer,name,age,birth,surname,stamp,random,curr) values(
			 @i, 		 concat('name',convert(VARCHAR(10),@i) ),
			10+@i,		GETDATE(),
			concat('surname_',convert(VARCHAR(10),@i*2+100000)),
			GETDATE(),
			RAND()*1000,
			RAND()*10000 );
 SET @i = @i+1;
END
END


GO

exec ctemp;
GO



DROP PROCEDURE  ctemp;



IF NOT EXISTS(select * from sysobjects where id = object_id(N'[seller]') and OBJECTPROPERTY(id, N'IsUserTable') = 1)
BEGIN

CREATE TABLE seller(
	idseller int NOT NULL,
	name varchar(100) NULL,
	age int NULL,
	birth datetime NULL,
	surname varchar(100) NULL,
	stamp datetime NULL,
	random int NULL,
	curr decimal(19,2) NULL,
	cf varchar(200),
	rtf image NULL,
	CONSTRAINT PK_seller PRIMARY KEY  (idseller)
);
END

GO

delete from seller
GO



CREATE PROCEDURE ctemp AS
BEGIN
declare @i int
set @i=1;
while (@i<600) BEGIN
insert into seller (idseller,name,age,birth,surname,stamp,random,curr,rtf,cf) values(
			 @i,
			 concat('name',convert(varchar(10),@i)	)	,10+@i,
			GETDATE(),
			concat('surname_',convert(varchar(10),@i*2+100000)),
			GETDATE(),
			RAND()*1000,
			RAND()*10000,
			0xFFFE69006600200065007800690073007400730020002800730065006C0065006300740020002A002000660072006F006D002000640062006F002E007300790073006F0062006A00650063007400730020007700680065007200650020006900640020003D0020006F0062006A006500630074005F006900640028004E0027005B00640062006F005D002E005B0075006E006900660069006500640074006100780063006F00720072006900670065005D0027002900200061006E00640020004F0042004A00450043005400500052004F00500045005200540059002800690064002C0020004E0027004900730055007300650072005400610062006C0065002700290020003D002000310029000D000A00640072006F00700020007400610062006C00650020005B00640062006F005D002E005B0075006E006900660069006500640074006100780063006F00720072006900670065005D000D000A0047004F000D000A000D000A0043005200450041005400450020005400410042004C00450020005B00640062006F005D002E005B0075006E006900660069006500640074006100780063006F00720072006900670065005D00200028000D000A0009005B006900640075006E006900660069006500640074006100780063006F00720072006900670065005D0020005B0069006E0074005D0020004E004F00540020004E0055004C004C0020002C000D000A0009005B006900640065007800700065006E007300650074006100780063006F00720072006900670065005D0020005B0069006E0074005D0020004E004F00540020004E0055004C004C0020002C000D000A0009005B0074006100780063006F00640065005D0020005B0069006E0074005D0020004E004F00540020004E0055004C004C0020002C000D000A0009005B00610079006500610072005D0020005B0073006D0061006C006C0069006E0074005D0020004E0055004C004C0020002C000D000A0009005B0065006D0070006C006F00790061006D006F0075006E0074005D0020005B0064006500630069006D0061006C005D002800310039002C0020003200290020004E0055004C004C0020002C000D000A0009005B00610064006D0069006E0061006D006F0075006E0074005D0020005B0064006500630069006D0061006C005D002800310039002C0020003200290020004E0055004C004C0020002C000D000A0009005B006900640063006900740079005D0020005B0069006E0074005D0020004E0055004C004C0020002C000D000A0009005B0069006400660069007300630061006C0074006100780072006500670069006F006E005D0020005B0076006100720063006800610072005D002000280035002900200043004F004C004C004100540045002000530051004C005F004C006100740069006E0031005F00470065006E006500720061006C005F004300500031005F00430049005F004100530020004E0055004C004C0020002C000D000A0009005B00610064006100740065005D0020005B006400610074006500740069006D0065005D0020004E0055004C004C0020002C000D000A0009005B00630074005D0020005B006400610074006500740069006D0065005D0020004E004F00540020004E0055004C004C0020002C000D000A0009005B00630075005D0020005B0076006100720063006800610072005D0020002800360034002900200043004F004C004C004100540045002000530051004C005F004C006100740069006E0031005F00470065006E006500720061006C005F004300500031005F00430049005F004100530020004E004F00540020004E0055004C004C0020002C000D000A0009005B006C0074005D0020005B006400610074006500740069006D0065005D0020004E004F00540020004E0055004C004C0020002C000D000A0009005B006C0075005D0020005B0076006100720063006800610072005D0020002800360034002900200043004F004C004C004100540045002000530051004C005F004C006100740069006E0031005F00470065006E006500720061006C005F004300500031005F00430049005F004100530020004E004F00540020004E0055004C004C0020002C000D000A0009005B006E006D006F006E00740068005D0020005B0073006D0061006C006C0069006E0074005D0020004E0055004C004C0020002C000D000A0009005B0069006400640062006400650070006100720074006D0065006E0074005D0020005B0076006100720063006800610072005D0020002800350030002900200043004F004C004C004100540045002000530051004C005F004C006100740069006E0031005F00470065006E006500720061006C005F004300500031005F00430049005F004100530020004E0055004C004C0020002C000D000A0009005B00690064007200650067005D0020005B0069006E0074005D0020004E0055004C004C0020002C000D000A0009005B0079006D006F0076005D0020005B0073006D0061006C006C0069006E0074005D0020004E0055004C004C0020002C000D000A0009005B006E006D006F0076005D0020005B0069006E0074005D0020004E0055004C004C0020002C000D000A0009005B006E007000610079005D0020005B0069006E0074005D0020004E0055004C004C0020002C000D000A0009005B00690064006500780070005D0020005B0069006E0074005D0020004E0055004C004C0020000D000A00290020004F004E0020005B005000520049004D004100520059005D000D000A0047004F000D000A000D000A00,
			convert(varchar(20),RAND()*100000)
            );
set @i=@i+1;
end
--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
END

GO

exec ctemp;


DROP PROCEDURE  ctemp;



IF NOT EXISTS(select * from sysobjects where id = object_id(N'[sellerkind]') and OBJECTPROPERTY(id, N'IsUserTable') = 1)
BEGIN


CREATE TABLE sellerkind(
	idsellerkind int NOT NULL,
	name varchar(100) NULL,
	rnd int NULL,
    CONSTRAINT PK_sellerkind PRIMARY KEY  (idsellerkind)
);

END


GO


delete from sellerkind
GO


CREATE PROCEDURE ctemp AS
BEGIN
declare @i int

set @i=0;
while (@i<20) BEGIN
insert into sellerkind (idsellerkind,name,rnd) values(
			 @i*30,
			 concat('name',convert(varchar(10),@i*30)),
			 RAND()*1000
		);
set @i=@i+1;
end

END


GO

exec ctemp;


DROP PROCEDURE  ctemp;



IF NOT EXISTS(select * from sysobjects where id = object_id(N'[customerkind]') and OBJECTPROPERTY(id, N'IsUserTable') = 1)
BEGIN

CREATE TABLE customerkind(
	idcustomerkind int NOT NULL,
	name varchar(100) NULL,
	rnd int NULL,
    CONSTRAINT PK_customerkind PRIMARY KEY  (idcustomerkind)
) ;

END

GO


delete from customerkind
GO


CREATE PROCEDURE ctemp AS
BEGIN
declare @i int

set @i=0;
while (@i<40) BEGIN
insert into customerkind (idcustomerkind,name,rnd) values(
			 @i*3,
			 concat('name',convert(varchar(10),@i*3)),
			RAND()*1000
		);
set @i=@i+1;
end ;


END


GO

exec ctemp;
GO

DROP PROCEDURE  ctemp;

GO

if exists (select * from dbo.sysobjects where id = object_id(N'[testSP2]') and OBJECTPROPERTY(id, N'IsProcedure') = 1)
drop procedure testSP2
GO


CREATE PROCEDURE testSP2 (@esercizio int,   @meseinizio int,  @mess varchar(200),   @defparam decimal(19,2)=2 ) AS
BEGIN
         select 'aa' as colA, 'bb' as colB, 12 as colC , @esercizio as original_esercizio,
         replace(@mess,'a','z') as newmess,   @defparam*2 as newparam;
END
GO


if exists (select * from dbo.sysobjects where id = object_id(N'[testSP1]') and OBJECTPROPERTY(id, N'IsProcedure') = 1)
drop procedure testSP1
GO


CREATE PROCEDURE testSP1( @esercizio int, @meseinizio int, @mesefine int OUTPUT,	@mess varchar(200), 	@defparam decimal(19,2)=2 ) AS
BEGIN
	set @mesefine= 12;
	select 'a' as colA, 'b' as colB, 12 as colC , @esercizio as original_esercizio,
		replace(@mess,'a','z') as newmess,
		@defparam*2 as newparam;
END

GO


if exists (select * from dbo.sysobjects where id = object_id(N'[testSP3]') and OBJECTPROPERTY(id, N'IsProcedure') = 1)
drop procedure testSP3
GO

CREATE  PROCEDURE  testSP3 (@esercizio int=0) AS
BEGIN
	select top 100 * from customer ;
	select top 100 * from seller ;
	select top 10 * from customerkind as c2 ;
	select top 10 * from sellerkind as s2 ;
END

GO
IF exists(SELECT * FROM [flowchart] WHERE idflowchart = '210001')
UPDATE [flowchart] SET address = null,ayear = '2021',cap = null,codeflowchart = '0001',ct = {ts '2020-12-21 11:00:20.257'},cu = 'NINO',fax = null,idcity = null,idsor1 = null,idsor2 = null,idsor3 = null,location = null,lt = {ts '2020-12-21 11:00:20.257'},lu = 'assistenza',nlevel = '1',paridflowchart = '21',phone = null,printingorder = '0001',title = 'Ateneo' WHERE idflowchart = '210001'
ELSE
INSERT INTO [flowchart] (idflowchart,address,ayear,cap,codeflowchart,ct,cu,fax,idcity,idsor1,idsor2,idsor3,location,lt,lu,nlevel,paridflowchart,phone,printingorder,title) VALUES ('210001',null,'2021',null,'0001',{ts '2020-12-21 11:00:20.257'},'NINO',null,null,null,null,null,null,{ts '2020-12-21 11:00:20.257'},'assistenza','1','21',null,'0001','Ateneo')
GO

IF exists(SELECT * FROM [flowchartuser] WHERE idcustomuser = '1' AND idflowchart = '210001' AND ndetail = '1')
UPDATE [flowchartuser] SET all_sorkind01 = null,all_sorkind02 = null,all_sorkind03 = null,all_sorkind04 = null,all_sorkind05 = null,ct = {ts '2020-12-21 11:00:20.257'},cu = 'NINO',flagdefault = 'N',
		idsor01 = null,idsor02 = null,idsor03 = null,idsor04 = null,idsor05 = null,lt = {ts '2020-12-21 11:00:20.257'},lu = 'assistenza',sorkind01_withchilds = null,sorkind02_withchilds = null,
		sorkind03_withchilds = null,sorkind04_withchilds = null,sorkind05_withchilds = null,start = {d '2000-01-01'},stop = null,
		title = 'Prova Classificazione' WHERE idcustomuser = '1' AND idflowchart = '210001' AND ndetail = '1'
ELSE
INSERT INTO [flowchartuser] (idcustomuser,idflowchart,ndetail,all_sorkind01,all_sorkind02,all_sorkind03,all_sorkind04,all_sorkind05,ct,cu,flagdefault,idsor01,idsor02,idsor03,idsor04,idsor05,lt,lu,
sorkind01_withchilds,sorkind02_withchilds,sorkind03_withchilds,sorkind04_withchilds,sorkind05_withchilds,start,stop,title) 
VALUES ('AZZURRO','210001','1',null,null,null,null,null,{ts '2020-12-21 11:00:20.257'},'NINO','N',null,null,null,null,null,
{ts '2020-12-21 11:00:20.257'},'assistenza',null,null,null,null,null,{d '2000-01-01'},null,'Prova Classificazione')
GO

--[DBO]--
-- CREAZIONE TABELLA web_listredir --
IF NOT EXISTS(select * from sysobjects where id = object_id(N'[dbo].[web_listredir]') and OBJECTPROPERTY(id, N'IsUserTable') = 1)
BEGIN
CREATE TABLE [dbo].[web_listredir] (
tablename varchar(50) NOT NULL,
listtype varchar(50) NOT NULL,
ct datetime NULL,
cu varchar(64) NULL,
lt datetime NULL,
lu varchar(64) NULL,
newlisttype varchar(50) NOT NULL,
newtablename varchar(50) NOT NULL,
 CONSTRAINT xpkweb_listredir PRIMARY KEY (tablename,
listtype
)
)
END
GO


if exists (select * from dbo.sysobjects where id = object_id(N'[compute_roles]') and OBJECTPROPERTY(id, N'IsProcedure') = 1)
drop procedure [compute_roles]
GO
--setuser 'amm'
--select * from flowchartuser
--compute_roles '01-01-2020','bianco'
CREATE PROCEDURE compute_roles
(
	@currdate date,
	@idcustomuser varchar(50)
)
AS BEGIN
		select U.idflowchart,
			isnull(U.title,F.title) as  title,
				U.ndetail,
				(U.idflowchart+'§'+convert(varchar(10),U.ndetail)) as k
				from flowchartuser U
					join flowchart F on U.idflowchart=F.idflowchart where
					F.ayear=year(@currdate) and
					U.idcustomuser = @idcustomuser and
						(U.start is null or U.start<= @currdate) and
						(U.stop is null or U.stop>= @currdate)
		order by 2


END

GO
SET QUOTED_IDENTIFIER OFF
GO
SET ANSI_NULLS ON
GO

-- CREAZIONE TABELLA audit --
IF NOT EXISTS(select * from sysobjects where id = object_id(N'[audit]') and OBJECTPROPERTY(id, N'IsUserTable') = 1)
BEGIN
CREATE TABLE [audit] (
idaudit varchar(30) NOT NULL,
consequence text NULL,
flagsystem char(1) NULL,
lt datetime NULL,
lu varchar(64) NULL,
severity char(1) NOT NULL,
title varchar(128) NOT NULL,
 CONSTRAINT xpkaudit PRIMARY KEY (idaudit
)
)
END
GO

delete from audit
GO

-- CREAZIONE TABELLA auditparameter --
IF NOT EXISTS(select * from sysobjects where id = object_id(N'[auditparameter]') and OBJECTPROPERTY(id, N'IsUserTable') = 1)
BEGIN
CREATE TABLE [auditparameter] (
tablename varchar(150) NOT NULL,
opkind char(1) NOT NULL,
isprecheck char(1) NOT NULL,
parameterid smallint NOT NULL,
flagoldvalue char(1) NULL,
paramcolumn varchar(150) NULL,
paramtable varchar(150) NULL,
 CONSTRAINT xpkauditparameter PRIMARY KEY (tablename,
opkind,
isprecheck,
parameterid
)
)
END
GO

delete from auditparameter
GO

-- CREAZIONE TABELLA auditcheck --
IF NOT EXISTS(select * from sysobjects where id = object_id(N'[auditcheck]') and OBJECTPROPERTY(id, N'IsUserTable') = 1)
BEGIN
CREATE TABLE [auditcheck] (
tablename varchar(150) NOT NULL,
opkind char(1) NOT NULL,
idaudit varchar(30) NOT NULL,
idcheck smallint NOT NULL,
flag_both char(1) NULL,
flag_cash char(1) NULL,
flag_comp char(1) NULL,
flag_credit char(1) NULL,
flag_proceeds char(1) NULL,
lt datetime NULL,
lu varchar(64) NULL,
message varchar(1000) NULL,
precheck char(1) NULL,
sqlcmd varchar(6000) NULL,
 CONSTRAINT xpkauditcheck PRIMARY KEY (tablename,
opkind,
idaudit,
idcheck
)
)
END
GO

delete from auditcheck
GO
-------------------------------------------------------------------------------------------------
------------------------------ DATI PER TEST SAVEDATASET CON REGOLE -----------------------------

--[DBO]--
IF not exists(SELECT * FROM [auditparameter] WHERE [tablename] = 'customuser' AND [opkind]= 'U')
INSERT INTO [auditparameter]
(tablename,
opkind,
isprecheck,
parameterid,
flagoldvalue,
paramcolumn,
paramtable)
VALUES
('customuser',
'U',
'N',
1,
'N',
'idcustomuser',
'customuser')
GO

--[DBO]--
IF not exists(SELECT * FROM [audit] WHERE [idaudit] = 'TEST001')
INSERT INTO [audit]
(idaudit,consequence,flagsystem,severity,title) VALUES ('TEST001','operation not permitted','N','E','TEST001 - Test')
GO

--[DBO]--
IF not exists(SELECT * FROM [auditcheck] WHERE [tablename] = 'customuser' AND [idaudit] = 'TEST001')
INSERT INTO [auditcheck]
(idaudit,tablename,opkind,idcheck,precheck,message,sqlcmd)
VALUES
('TEST001','customuser','U',1,'N','operation not permitted msg','([select count(idcustomuser) from customusergroup idcustomuser = %<customuser.idcustomuser>%)]{I} = 0)')
GO

-- CREAZIONE VISTA auditcheckview
IF EXISTS(select * from sysobjects where id = object_id(N'[auditcheckview]') and OBJECTPROPERTY(id, N'IsView') = 1)
DROP VIEW [auditcheckview]
GO

--Pino Rana, elaborazione del 10/08/2005 15:18:11
CREATE VIEW auditcheckview
	(
	tablename,
	opkind,
	idcheck,
	idaudit,
	title,
	severity,
	sqlcmd,
	message,
	precheck,
	flag_comp,
	flag_cash,
	flag_both,
	flag_credit,
	flag_proceeds
	)
	AS SELECT
	auditcheck.tablename,
	auditcheck.opkind,
	auditcheck.idcheck,
	auditcheck.idaudit,
	audit.title,
	audit.severity,
	auditcheck.sqlcmd,
	auditcheck.message,
	auditcheck.precheck,
	auditcheck.flag_comp,
	auditcheck.flag_cash,
	auditcheck.flag_both,
	auditcheck.flag_credit,
	auditcheck.flag_proceeds
	FROM auditcheck (NOLOCK)
	JOIN audit (NOLOCK)
	ON audit.idaudit = auditcheck.idaudit
GO

--- SP per regola 'TEST001'
if exists (select * from dbo.sysobjects where id = object_id(N'[check_customuser_u_post]') and OBJECTPROPERTY(id, N'IsProcedure') = 1)
drop procedure [check_customuser_u_post]
GO

CREATE PROCEDURE check_customuser_u_post
(
    @res SMALLINT OUT,
    @new_idcustomuser varchar(50) = ''
)
AS BEGIN
    SET NOCOUNT ON
    SET @res=0
    declare @v01 int
    SET @v01=0
    SELECT @v01 = count(idcustomuser) FROM customusergroup where idcustomuser=@new_idcustomuser

    -- idcheck: 1
    -- idaudit: CUSTOMUSER
    if not((@v01=0))SET @res=@res+0x1
END
GO


------------------------------------------------------------------------------------------------------------------------
---------------------------------- FINE DATI PER REGOLE POST -----------------------------------------------------------

---------------------------------- DATI PER LOGIN ----------------------------------------------------------------------
------------------------------------------------------------------------------------------------------------------------
--[DBO]--
-- CREAZIONE TABELLA virtualuser --
IF NOT EXISTS(select * from sysobjects where id = object_id(N'[dbo].[virtualuser]') and OBJECTPROPERTY(id, N'IsUserTable') = 1)
BEGIN
CREATE TABLE [dbo].[virtualuser] (
idvirtualuser int NOT NULL,
birthdate date NULL,
cf varchar(16) NULL,
codicedipartimento varchar(50) NOT NULL,
email varchar(200) NULL,
forename varchar(50) NOT NULL,
lt datetime NULL,
lu varchar(64) NULL,
surname varchar(50) NOT NULL,
sys_user varchar(30) NOT NULL,
userkind smallint NOT NULL,
username varchar(50) NOT NULL,
 CONSTRAINT xpkvirtualuser PRIMARY KEY (idvirtualuser
)
)
END
GO

delete from virtualuser
GO

--[DBO]--
-- CREAZIONE TABELLA registryreference --
IF NOT EXISTS(select * from sysobjects where id = object_id(N'[dbo].[registryreference]') and OBJECTPROPERTY(id, N'IsUserTable') = 1)
BEGIN
CREATE TABLE [dbo].[registryreference] (
idreg int NOT NULL,
idregistryreference int NOT NULL,
activeweb char(1) NULL,
ct datetime NOT NULL,
cu varchar(64) NOT NULL,
email varchar(200) NULL,
faxnumber varchar(50) NULL,
flagdefault char(1) NULL,
iterweb int NULL,
lt datetime NOT NULL,
lu varchar(64) NOT NULL,
mobilenumber varchar(20) NULL,
msnnumber varchar(50) NULL,
passwordweb varchar(40) NULL,
pec varchar(200) NULL,
phonenumber varchar(50) NULL,
referencename varchar(50) NOT NULL,
registryreferencerole varchar(50) NULL,
rtf image NULL,
saltweb varchar(20) NULL,
skypenumber varchar(50) NULL,
txt text NULL,
userweb varchar(40) NULL,
website varchar(512) NULL,
 CONSTRAINT xpkregistryreference PRIMARY KEY (idreg,
idregistryreference
)
)
END
GO

delete from registryreference
GO

--[DBO]--
-- utente di test pwd: SEG_PSUMA registryreference --
IF not exists(SELECT * FROM [registryreference] WHERE [idregistryreference] = 1)
INSERT INTO [registryreference]
(idreg,idregistryreference,
referencename,
userweb,
passwordweb,saltweb,iterweb,
ct,cu,lt,lu)
VALUES
(1,1,
'azzurro.test',
'AZZURRO',
'59E2D39F8567522107455FC74F048BC0B4723937','2B2214D4E17E203C3B4A',98,
{ts '2011-10-18 11:11:12.563'},'sa',{ts '2011-10-18 11:11:12.420'},'sa')
GO

--[DBO]--
-- CREAZIONE TABELLA attach --
IF NOT EXISTS(select * from sysobjects where id = object_id(N'[dbo].[attach]') and OBJECTPROPERTY(id, N'IsUserTable') = 1)
BEGIN
CREATE TABLE [dbo].[attach] (
idattach int NOT NULL,
attachment image NULL,
counter int NULL,
ct datetime NULL,
cu varchar(64) NULL,
filename varchar(512) NULL,
hash varchar(max) NULL,
lt datetime NULL,
lu varchar(64) NULL,
size bigint NULL,
 CONSTRAINT xpkattach PRIMARY KEY (idattach
)
)
END
GO

delete from attach
GO


