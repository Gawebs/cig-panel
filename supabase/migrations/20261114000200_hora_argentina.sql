-- Las fechas por defecto (apertura del expediente, día del relevamiento) y los controles de
-- "fecha futura" usan la fecha de Argentina, no la de Londres: después de las 21 h daban el día siguiente.
alter database postgres set timezone to 'America/Argentina/Buenos_Aires';
