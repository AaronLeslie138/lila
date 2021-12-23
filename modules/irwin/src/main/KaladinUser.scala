package lila.irwin

import org.joda.time.DateTime

import lila.report.SuspectId
import lila.user.User
import lila.report.Suspect
import lila.user.Holder

case class KaladinUser(
    _id: User.ID,
    priority: Int,
    queuedAt: DateTime,
    queuedBy: KaladinUser.Requester,
    startedAt: Option[DateTime] = None,
    response: Option[KaladinUser.Response] = None
) {

  def suspectId = SuspectId(_id)

  def recentlyQueued = queuedAt isAfter DateTime.now.minusWeeks(1)

  def queueAgain(by: KaladinUser.Requester): Option[KaladinUser] =
    if (startedAt.isEmpty && by.priority > priority)
      copy(
        priority = by.priority,
        queuedBy = by
      ).some
    else if (!recentlyQueued)
      copy(
        priority = by.priority,
        queuedAt = DateTime.now,
        queuedBy = by,
        startedAt = none,
        response = none
      ).some
    else none
}

object KaladinUser {

  def make(suspect: Suspect, by: Requester) = KaladinUser(
    _id = suspect.id.value,
    priority = by.priority,
    queuedAt = DateTime.now,
    queuedBy = by
  )

  sealed abstract class Requester(val priority: Int) {
    def name = toString
  }
  object Requester {
    case class Mod(id: User.ID) extends Requester(100) {
      override def name = id
    }
    case object TopOnline        extends Requester(10)
    case object TournamentLeader extends Requester(20)
    case object Report           extends Requester(30)
  }

  case class Response(at: DateTime, pred: Pred)
  // Pred, short for Predication, activation, float between 0 and 1, 
  // the higher the more likely the user is cheating
  case class Pred(activation: Float, insights: List[String], tc: Int)

  case class Dashboard(recent: List[KaladinUser]) {

    def lastSeenAt = recent.view.map(_.response) collectFirst { case Some(response) =>
      response.at
    }

    def seenRecently = lastSeenAt.??(DateTime.now.minusMinutes(30).isBefore)
  }
}
