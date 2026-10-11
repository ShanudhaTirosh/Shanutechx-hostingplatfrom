export type RootStackParamList = {
  Splash: undefined;
  Login: undefined;
  Main: undefined;
  TicketChat: { ticketId: string; subject: string };
  Notifications: undefined;
  DeploymentDetail: { deploymentId: string; name: string };
  Payments: undefined;
};

export type MainTabParamList = {
  Dashboard: undefined;
  Deployments: undefined;
  Tickets: undefined;
  Nodes: undefined;
  Analytics: undefined;
  Profile: undefined;
};
