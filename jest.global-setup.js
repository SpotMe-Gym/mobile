// Tests run in a zone with a UTC offset (where the old day-boundary bug showed up), so date
// logic can't accidentally pass just because the CI machine is on UTC.
module.exports = async () => {
  process.env.TZ = 'Europe/Rome';
};
