module.exports = {
  apps: [
    {
      name: "immigration-schedule",
      cwd: "/var/www/allprojects/immigration-schedule",
      script: "node_modules/.bin/next",
      args: "start -p 3003",
      interpreter: "none",
    },
  ],
};
